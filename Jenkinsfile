pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        skipStagesAfterUnstable()
    }

    environment {
        VERSION = ""
        LOCAL_REGISTRY = "toppancrvs"

        // AWS ECR Configuration
        AWS_REGION = "${env.AWS_REGION ?: 'ap-east-1'}"
        AWS_ACCOUNT = "${env.AWS_ACCOUNT ?: '695491315778'}"
        ECR_REGISTRY = "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        ECR_REPO_PREFIX = "${env.ECR_REPO_PREFIX ?: 'toppancrvs'}"

        // Docker
        DOCKER_BUILDKIT = '1'
    }

    parameters {
        booleanParam(
            name: 'NO_CACHE',
            defaultValue: false,
            description: 'Build without Docker cache'
        )
        booleanParam(
            name: 'PUSH_TO_ECR',
            defaultValue: true,
            description: 'Push built images to AWS ECR'
        )
        booleanParam(
            name: 'DRY_RUN',
            defaultValue: false,
            description: 'Preview build without executing'
        )
        string(
            name: 'CUSTOM_VERSION',
            defaultValue: '',
            description: 'Custom version tag (leave empty for git hash)'
        )
        string(
            name: 'COUNTRY',
            defaultValue: 'FAR',
            description: 'Country code (FAR, ATG, MDV, etc.)'
        )
    }

    stages {
        stage('Initialize') {
            steps {
                script {
                    if (params.CUSTOM_VERSION) {
                        env.VERSION = params.CUSTOM_VERSION
                    } else {
                        env.VERSION = sh(
                            script: 'git log -1 --pretty=format:%h',
                            returnStdout: true
                        ).trim()
                    }

                    env.IMAGE_NAME = "countryconfig"
                    if (params.COUNTRY != 'FAR') {
                        env.IMAGE_NAME = "countryconfig-${params.COUNTRY.toLowerCase()}"
                    }

                    echo "========================================"
                    echo "OpenCRVS Country Config Build"
                    echo "========================================"
                    echo "Version:  ${env.VERSION}"
                    echo "Country:  ${params.COUNTRY}"
                    echo "Image:    ${env.IMAGE_NAME}"
                    echo "Registry: ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}"
                    echo "========================================"
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    if (params.DRY_RUN) {
                        echo "[DRY-RUN] Would build: ${env.IMAGE_NAME}:${env.VERSION}"
                        return
                    }

                    def cacheArg = params.NO_CACHE ? '--no-cache' : ''

                    echo "Building countryconfig image..."

                    sh """
                        docker build ${cacheArg} \
                            -t ${env.LOCAL_REGISTRY}/${env.IMAGE_NAME}:${env.VERSION} \
                            -t ${env.LOCAL_REGISTRY}/${env.IMAGE_NAME}:latest \
                            --build-arg COUNTRY=${params.COUNTRY} \
                            .
                    """

                    echo "Build completed: ${env.LOCAL_REGISTRY}/${env.IMAGE_NAME}:${env.VERSION}"
                }
            }
        }

        stage('Push to ECR') {
            when {
                allOf {
                    expression { params.PUSH_TO_ECR == true }
                    expression { params.DRY_RUN == false }
                }
            }
            steps {
                script {
                    echo "Pushing to ECR..."

                    withCredentials([aws(credentialsId: 'aws-ecr-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                        sh """
                            # ECR login
                            aws ecr get-login-password --region ${env.AWS_REGION} | \
                                docker login --username AWS --password-stdin ${env.ECR_REGISTRY}

                            # Tag for ECR
                            docker tag ${env.LOCAL_REGISTRY}/${env.IMAGE_NAME}:${env.VERSION} \
                                ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}/${env.IMAGE_NAME}:${env.VERSION}

                            docker tag ${env.LOCAL_REGISTRY}/${env.IMAGE_NAME}:latest \
                                ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}/${env.IMAGE_NAME}:latest

                            # Push
                            docker push ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}/${env.IMAGE_NAME}:${env.VERSION}
                            docker push ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}/${env.IMAGE_NAME}:latest
                        """
                    }

                    echo "Pushed: ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}/${env.IMAGE_NAME}:${env.VERSION}"
                }
            }
        }
    }

    post {
        always {
            sh 'docker system prune -f || true'
        }
        success {
            echo "Country config build successful!"
            echo "Image: ${env.ECR_REGISTRY}/${env.ECR_REPO_PREFIX}/${env.IMAGE_NAME}:${env.VERSION}"
        }
        failure {
            echo "Country config build FAILED"
        }
    }
}