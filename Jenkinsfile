pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 90, unit: 'MINUTES')
  }

  parameters {
    choice(
      name: 'DEPLOY_ENV',
      choices: ['staging', 'production'],
      description: 'Target environment for deploy'
    )
    booleanParam(
      name: 'SKIP_DEPLOY',
      defaultValue: false,
      description: 'Build and test only — skip deploy stage'
    )
    booleanParam(
      name: 'FORCE_RECREATE',
      defaultValue: false,
      description: 'Force recreate containers on deploy'
    )
    booleanParam(
      name: 'RESET_DATA',
      defaultValue: false,
      description: 'Delete rendered-video volumes. Leave OFF so generated videos survive deploys.'
    )
    string(
      name: 'ENV_CREDENTIAL_ID',
      defaultValue: 'shortvideo-env-file',
      description: 'Jenkins Secret file credential ID'
    )
  }

  environment {
    APP_NAME             = 'shortvideo'
    APP_IMAGE            = "shortvideo-app:${env.BUILD_NUMBER}"
    APP_IMAGE_LATEST     = 'shortvideo-app:latest'
    COMPOSE_PROJECT_NAME = 'shortvideo'
    DOCKER_BUILDKIT      = '1'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh '''
          echo "Branch: ${GIT_BRANCH:-unknown}"
          echo "Commit: ${GIT_COMMIT:-unknown}"
          git rev-parse --short HEAD || true
          echo "=== Workspace files ==="
          ls -la
          test -f docker-compose.yml || { echo "ERROR: docker-compose.yml missing"; exit 1; }
          test -f main-tiny.Dockerfile || { echo "ERROR: main-tiny.Dockerfile missing"; exit 1; }
          test -f package.json || { echo "ERROR: package.json missing"; exit 1; }
          test -f scripts/normalize_deploy_env.py || { echo "ERROR: normalize_deploy_env.py missing"; exit 1; }
        '''
      }
    }

    stage('Detect Tools') {
      steps {
        sh '''
          echo "=== Agent tools ==="
          docker --version
          docker compose version
          echo "WORKSPACE=${WORKSPACE}"
          echo "PWD=$(pwd)"
        '''
      }
    }

    stage('Prepare Env') {
      when {
        expression { return !params.SKIP_DEPLOY }
      }
      steps {
        script {
          def usedEnv = false
          def credId = params.ENV_CREDENTIAL_ID ?: 'shortvideo-env-file'

          try {
            withCredentials([file(credentialsId: credId, variable: 'ENV_FILE')]) {
              sh '''
                echo "Secret file path bound: $ENV_FILE"
                test -f "$ENV_FILE" || { echo "ERROR: credential file path missing"; exit 1; }
                cp -f "$ENV_FILE" .env.deploy
                echo "Copied ${ENV_CREDENTIAL_ID} → .env.deploy"
              '''
              usedEnv = true
            }
          } catch (err) {
            echo "Could not load credential ${credId}: ${err}"
            echo "Check: Manage Jenkins → Credentials → ID is exactly shortvideo-env-file (Secret file)."
          }

          if (!usedEnv) {
            sh '''
              echo "=== Looking for fallback env files ==="
              ls -la shortvideo.env .env /var/jenkins_home/shortvideo.env /var/jenkins_home/secrets/shortvideo.env 2>/dev/null || true
            '''
            def candidates = [
              '/var/jenkins_home/secrets/shortvideo.env',
              '/var/jenkins_home/shortvideo.env',
              'shortvideo.env',
              '.env',
            ]
            for (p in candidates) {
              if (fileExists(p)) {
                sh "cp -f '${p}' .env.deploy"
                usedEnv = true
                echo "Using env file: ${p} → .env.deploy"
                break
              }
            }
          }

          if (!usedEnv) {
            error('''No env source found.
Create Jenkins credential:
  Kind: Secret file
  ID: shortvideo-env-file
  Scope: Global
Then rebuild.''')
          }

          sh '''
            set -e
            python3 scripts/normalize_deploy_env.py .env.deploy
            echo "=== Required keys present ==="
            grep -E '^(PEXELS_API_KEY|APP_HOST_PORT|PORT)=' .env.deploy | sed 's/=.*/=***/'
          '''
          echo "Prepared .env.deploy for ${params.DEPLOY_ENV}"
        }
      }
    }

    stage('Clean') {
      steps {
        script {
          sh '''
            set +e
            echo "=== Stop previous Short Video Maker containers ==="
            docker compose -f docker-compose.yml down --remove-orphans || true
            docker rm -f shortvideo-app 2>/dev/null || true
            docker rmi -f shortvideo-app:latest 2>/dev/null || true
            echo "=== Remaining shortvideo images ==="
            docker images | grep shortvideo || echo none
            echo "=== Docker volumes ==="
            docker volume ls
          '''
          if (params.RESET_DATA) {
            sh '''
              set +e
              echo "RESET_DATA=true — deleting rendered video volumes"
              docker volume rm -f shortvideo_videos shortvideo_temp 2>/dev/null || true
              docker volume ls
            '''
          } else {
            echo "Keeping shortvideo_videos so rendered files survive this deploy"
          }
        }
      }
    }

    stage('Docker Build') {
      steps {
        sh '''
          set -e
          echo "Building Short Video Maker image (tiny whisper + q4 kokoro)..."
          docker build \
            --no-cache \
            -f main-tiny.Dockerfile \
            -t ${APP_IMAGE} \
            -t ${APP_IMAGE_LATEST} \
            .
          docker images | grep shortvideo | head -n 20 || docker images | head -n 12
        '''
      }
    }

    stage('Smoke Test') {
      steps {
        sh '''
          set -e
          docker run --rm --entrypoint node ${APP_IMAGE} -e "const fs=require('fs'); fs.accessSync('/app/dist/index.js'); fs.accessSync('/app/dist/ui/index.html'); console.log('smoke_ok')"
        '''
      }
    }

    stage('Deploy') {
      when {
        expression { return !params.SKIP_DEPLOY }
      }
      steps {
        sh '''
          set -e
          export IMAGE_TAG=${BUILD_NUMBER}
          export APP_HOST_PORT=${APP_HOST_PORT:-3123}
          cp -f .env.deploy .env

          set -a
          # shellcheck disable=SC1091
          . ./.env
          set +a

          echo "Freeing previous Short Video Maker containers (if any)..."
          docker compose -f docker-compose.yml down --remove-orphans || true
          docker rm -f shortvideo-app 2>/dev/null || true

          echo "Starting app from the image just built..."
          docker compose -f docker-compose.yml up -d --no-build --force-recreate app

          echo "Waiting for health via docker exec..."
          i=1
          while [ "$i" -le 60 ]; do
            if docker exec shortvideo-app curl -fsS http://127.0.0.1:3123/health >/tmp/shortvideo_health.json 2>/dev/null; then
              echo "App healthy"
              cat /tmp/shortvideo_health.json
              echo
              docker compose -f docker-compose.yml ps
              exit 0
            fi
            STATUS="$(docker inspect -f '{{.State.Health.Status}}' shortvideo-app 2>/dev/null || echo unknown)"
            echo "attempt ${i}: health=${STATUS}"
            i=$((i + 1))
            sleep 5
          done
          echo "Health check failed"
          docker compose -f docker-compose.yml ps || true
          docker compose -f docker-compose.yml logs --tail=120
          exit 1
        '''
      }
    }

    stage('Post-Deploy Check') {
      when {
        expression { return !params.SKIP_DEPLOY }
      }
      steps {
        sh '''
          set -e
          echo "=== Container status ==="
          docker compose -f docker-compose.yml ps || true
          echo "=== Health (docker exec) ==="
          docker exec shortvideo-app curl -fsS http://127.0.0.1:3123/health
          echo
          echo "=== UI responds ==="
          docker exec shortvideo-app curl -fsS -o /tmp/shortvideo_ui.html -w "http:%{http_code}\\n" http://127.0.0.1:3123/ || true
          if [ -s /tmp/shortvideo_ui.html ]; then
            echo "ui_ok bytes=$(wc -c </tmp/shortvideo_ui.html)"
          else
            echo "WARN: could not fetch UI HTML from inside container"
            docker logs shortvideo-app --tail=40 || true
          fi
        '''
      }
    }
  }

  post {
    success {
      echo "Short Video Maker ${params.DEPLOY_ENV} build #${env.BUILD_NUMBER} succeeded"
      echo "UI/API: https://shorts.doxstation.com"
      echo "Direct: http://187.127.138.86:3123"
      echo "Health: https://shorts.doxstation.com/health"
    }
    failure {
      echo "Short Video Maker build #${env.BUILD_NUMBER} failed — check stage logs"
      sh 'docker compose -f docker-compose.yml logs --tail=120 || true'
    }
    always {
      sh 'rm -f .env.deploy.bak || true'
    }
  }
}
