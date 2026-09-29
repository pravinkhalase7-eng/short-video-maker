pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 90, unit: 'MINUTES')
  }

  parameters {
    booleanParam(
      name: 'RESET_DATA',
      defaultValue: false,
      description: 'Wipe temp + video volumes. Default keeps rendered videos.'
    )
    booleanParam(
      name: 'FORCE_RECREATE',
      defaultValue: true,
      description: 'Force-recreate the app container after the new image is built.'
    )
    booleanParam(
      name: 'FORCE_NO_CACHE',
      defaultValue: false,
      description: 'Rebuild every Docker layer from scratch. Leave off — cache is ~1 min vs ~17 min.'
    )
  }

  environment {
    COMPOSE_FILE     = 'docker-compose.yml'
    IMAGE_NAME       = 'shortvideo-app'
    CONTAINER_NAME   = 'shortvideo-app'
    PUBLIC_URL       = 'https://shorts.doxstation.com'
    DIRECT_URL       = 'http://187.127.138.86:3123'
    APP_HOST_PORT    = '3123'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh '''
          echo "Branch: ${GIT_BRANCH}"
          echo "Commit: ${GIT_COMMIT}"
          git rev-parse --short HEAD
          echo "=== Workspace files ==="
          ls -la
          test -f docker-compose.yml
          test -f main-tiny.Dockerfile
          test -f package.json
          test -f scripts/normalize_deploy_env.py
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
      steps {
        script {
          withCredentials([file(credentialsId: 'shortvideo-env-file', variable: 'ENV_FILE')]) {
            sh '''
              echo "Secret file path bound: ${ENV_FILE}"
              test -f "${ENV_FILE}"
              cp -f "${ENV_FILE}" .env.deploy
              echo "Copied shortvideo-env-file → .env.deploy"
            '''
          }

          sh '''
            set -e
            python3 scripts/normalize_deploy_env.py .env.deploy
            echo "=== Required keys present ==="
            grep -E '^(PEXELS_API_KEY|APP_HOST_PORT|PORT)=' .env.deploy | sed 's/=.*/=***/'
          '''

          echo "Prepared .env.deploy for staging"
        }
      }
    }

    stage('Docker Build') {
      steps {
        sh """
          set -e
          CACHE_FLAG=""
          if [ "${params.FORCE_NO_CACHE}" = "true" ]; then
            CACHE_FLAG="--no-cache"
            echo "FORCE_NO_CACHE is on — rebuilding every layer"
          else
            echo "Using Docker layer cache (whisper/apt/pnpm stay cached unless those files change)"
          fi
          echo "Building Short Video Maker image (tiny whisper + q4 kokoro)..."
          docker build \$CACHE_FLAG -f main-tiny.Dockerfile \\
            -t ${IMAGE_NAME}:${BUILD_NUMBER} \\
            -t ${IMAGE_NAME}:latest .
          docker images | grep shortvideo | head -n 20
        """
      }
    }

    stage('Smoke Test') {
      steps {
        sh """
          set -e
          docker run --rm --entrypoint node ${IMAGE_NAME}:${BUILD_NUMBER} -e "const fs=require('fs'); fs.accessSync('/app/dist/index.js'); fs.accessSync('/app/dist/ui/index.html'); console.log('smoke_ok')"
        """
      }
    }

    stage('Deploy') {
      steps {
        sh """
          set -e
          export IMAGE_TAG=${BUILD_NUMBER}
          set +x
          APP_HOST_PORT=\$(awk -F= '/^APP_HOST_PORT=/{print \$2}' .env.deploy | tr -d '\\r')
          export APP_HOST_PORT="\${APP_HOST_PORT:-3123}"
          set -x
          cp -f .env.deploy .env
          echo "Swapping to image ${IMAGE_NAME}:${BUILD_NUMBER} on host port \${APP_HOST_PORT}..."
          docker compose -f ${COMPOSE_FILE} down --remove-orphans || true
          docker rm -f ${CONTAINER_NAME} || true
          if [ "${params.RESET_DATA}" = "true" ]; then
            echo "RESET_DATA: wiping shortvideo_temp and shortvideo_videos"
            docker volume rm -f shortvideo_temp shortvideo_videos || true
          else
            echo "Keeping shortvideo_videos so rendered files survive this deploy"
          fi
          UP_FLAGS="-d --no-build"
          if [ "${params.FORCE_RECREATE}" = "true" ]; then
            UP_FLAGS="\$UP_FLAGS --force-recreate"
          fi
          echo "Starting app from the image just built..."
          docker compose -f ${COMPOSE_FILE} up \$UP_FLAGS app
          echo "Waiting for health via docker exec..."
          i=1
          while [ \$i -le 60 ]; do
            if docker exec ${CONTAINER_NAME} curl -fsS http://127.0.0.1:3123/health > /tmp/shortvideo_health.json 2>/dev/null; then
              echo "App healthy"
              cat /tmp/shortvideo_health.json
              echo
              docker compose -f ${COMPOSE_FILE} ps
              exit 0
            fi
            STATUS=\$(docker inspect -f '{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo unknown)
            echo "attempt \$i: health=\$STATUS"
            i=\$((i + 1))
            sleep 5
          done
          echo "App failed to become healthy"
          docker compose -f ${COMPOSE_FILE} ps || true
          docker logs ${CONTAINER_NAME} --tail=80 || true
          exit 1
        """
      }
    }

    stage('Post-Deploy Check') {
      steps {
        sh """
          set -e
          echo "=== Container status ==="
          docker compose -f ${COMPOSE_FILE} ps
          echo "=== Health (docker exec) ==="
          docker exec ${CONTAINER_NAME} curl -fsS http://127.0.0.1:3123/health
          echo
          echo "=== UI responds ==="
          docker exec ${CONTAINER_NAME} curl -fsS -o /tmp/shortvideo_ui.html -w 'http:%{http_code}\\n' http://127.0.0.1:3123/
          if docker exec ${CONTAINER_NAME} test -s /tmp/shortvideo_ui.html; then
            echo "UI HTML fetched"
          else
            echo "WARN: could not fetch UI HTML from inside container"
          fi
          docker logs ${CONTAINER_NAME} --tail=40 || true
        """
      }
    }
  }

  post {
    always {
      sh 'rm -f .env.deploy.bak || true'
    }
    success {
      echo "Short Video Maker staging build #${BUILD_NUMBER} succeeded"
      echo "UI/API: ${PUBLIC_URL}"
      echo "Direct: ${DIRECT_URL}"
      echo "Health: ${PUBLIC_URL}/health"
    }
    failure {
      echo "Short Video Maker staging build #${BUILD_NUMBER} failed"
      sh """
        docker compose -f ${COMPOSE_FILE} ps || true
        docker logs ${CONTAINER_NAME} --tail=80 || true
      """
    }
  }
}
