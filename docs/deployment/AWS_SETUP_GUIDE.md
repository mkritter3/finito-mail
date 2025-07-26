# 🚀 AWS Production Deployment Guide

This guide provides step-by-step instructions for deploying Finito Mail to AWS production infrastructure.

## 📋 Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured locally
- GitHub repository with the project code
- Domain name for the application (optional but recommended)

## 🔐 Step 1: Create Security Groups

Go to **VPC > Security Groups** and create the following security groups:

### 1. Database Security Group
- **Name:** `finito-db-sg`
- **Description:** Security group for PostgreSQL database
- **Inbound Rules:**
  - Type: `PostgreSQL`
  - Port: `5432`
  - Source: `finito-ecs-sg` (select from dropdown)

### 2. Cache Security Group
- **Name:** `finito-cache-sg`
- **Description:** Security group for Redis cache
- **Inbound Rules:**
  - Type: `Custom TCP`
  - Port: `6379`
  - Source: `finito-ecs-sg`

### 3. ECS Tasks Security Group
- **Name:** `finito-ecs-sg`
- **Description:** Security group for ECS tasks
- **Inbound Rules:**
  - Type: `All Traffic`
  - Source: `finito-ecs-sg` (self-referencing)
  - Type: `All Traffic`
  - Source: `finito-alb-sg` (will create next)

### 4. Application Load Balancer Security Group
- **Name:** `finito-alb-sg`
- **Description:** Security group for ALB
- **Inbound Rules:**
  - Type: `HTTP`
  - Port: `80`
  - Source: `0.0.0.0/0` (Anywhere)
  - Type: `HTTPS`
  - Port: `443`
  - Source: `0.0.0.0/0` (Anywhere)

## 📊 Step 2: Create Data Stores

### RDS PostgreSQL Database
1. Go to **RDS > Create database**
2. Choose **Standard Create**
3. Engine: **PostgreSQL**
4. Template: **Production** (or **Free tier** for testing)
5. **Database Settings:**
   - DB instance identifier: `finito-db`
   - Master username: `postgres`
   - Master password: Generate and store securely
6. **Instance Configuration:**
   - DB instance class: `db.t3.micro` (free tier) or `db.t3.small` (production)
7. **Connectivity:**
   - VPC: Select your default VPC
   - Public access: **No**
   - VPC security group: Select `finito-db-sg`
8. **Additional Configuration:**
   - Initial database name: `finito_mail`
   - Backup retention: 7 days
   - Enable automated backups
9. **Create database**

**📝 Note:** Save the RDS endpoint URL for later use in secrets.

### ElastiCache Redis Cluster
1. Go to **ElastiCache > Create Redis cluster**
2. **Cluster Settings:**
   - Name: `finito-redis`
   - Node type: `cache.t3.micro` (free tier) or `cache.t3.small`
3. **Subnet Groups:**
   - Create new subnet group
   - Select all private subnets in your VPC
4. **Security:**
   - Security group: Select `finito-cache-sg`
5. **Create cluster**

**📝 Note:** Save the Redis Primary Endpoint for later use in secrets.

## 🗂️ Step 3: Create ECR Repositories

Go to **ECR > Repositories** and create three private repositories:

1. **Repository name:** `finito-api`
2. **Repository name:** `finito-web`
3. **Repository name:** `finito-migrate`

**📝 Note:** Copy the repository URIs for use in GitHub Actions.

## 🔑 Step 4: Configure IAM Roles

### A. ECS Task Execution Role
1. Go to **IAM > Roles > Create role**
2. **Trusted entity:** AWS service
3. **Use case:** Elastic Container Service Task
4. **Permissions:** Attach `AmazonECSTaskExecutionRolePolicy`
5. **Role name:** `ecsTaskExecutionRole`

#### Add Secrets Manager Policy
1. Open the created role
2. Click **Add permissions > Create inline policy**
3. Use JSON editor and add:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "secretsmanager:GetSecretValue",
            "Resource": "arn:aws:secretsmanager:*:*:secret:finito/production/env-*"
        }
    ]
}
```

### B. GitHub Actions OIDC Setup
1. Go to **IAM > Identity providers**
2. **Add provider**
3. **Provider type:** OpenID Connect
4. **Provider URL:** `https://token.actions.githubusercontent.com`
5. **Audience:** `sts.amazonaws.com`

#### Create GitHub ECR Role
1. **IAM > Roles > Create role**
2. **Custom trust policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/finito-mail:ref:refs/heads/main"
                }
            }
        }
    ]
}
```
3. **Permissions:** Attach `AmazonEC2ContainerRegistryPowerUser`
4. **Role name:** `GitHubAction-ECR-Role`

#### Create GitHub ECS Deploy Role
1. **IAM > Roles > Create role**
2. **Custom trust policy:** Same as above
3. **Custom permissions policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecs:RunTask",
                "ecs:UpdateService",
                "ecs:DescribeServices",
                "ecs:DescribeTasks"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole"
        }
    ]
}
```
4. **Role name:** `GitHubAction-ECS-Deploy-Role`

## 🔐 Step 5: Configure Secrets Manager

1. Go to **Secrets Manager > Store a new secret**
2. **Secret type:** Other type of secret
3. **Plaintext:** Copy content from `deployment/aws-secrets-template.json`
4. **Update values:**
   - `DATABASE_URL`: Use your RDS endpoint
   - `UPSTASH_REDIS_URL`: Use your ElastiCache endpoint
   - Generate secure values for `NEXTAUTH_SECRET` and `HEALTH_API_KEY`
   - Configure your Google OAuth credentials
5. **Secret name:** `finito/production/env`

## 🖧 Step 6: Create Application Load Balancer

### A. Create Target Groups
1. Go to **EC2 > Target Groups > Create target group**
2. **Target type:** IP addresses
3. **Target group name:** `finito-api-tg`
4. **Protocol:** HTTP, **Port:** 3001
5. **VPC:** Select your VPC
6. **Health check path:** `/api/health`
7. **Create target group**

Repeat for web service:
- **Target group name:** `finito-web-tg`
- **Port:** 3000
- **Health check path:** `/`

### B. Create Load Balancer
1. Go to **EC2 > Load Balancers > Create Load Balancer**
2. **Application Load Balancer**
3. **Name:** `finito-alb`
4. **Scheme:** Internet-facing
5. **VPC:** Select your VPC
6. **Subnets:** Select public subnets
7. **Security group:** Select `finito-alb-sg`
8. **Listeners:**
   - **Protocol:** HTTP, **Port:** 80
   - **Default action:** Forward to `finito-web-tg`
9. **Create load balancer**

### C. Configure ALB Rules
1. Open your ALB
2. Go to **Listeners** tab
3. **View/edit rules**
4. **Add rule:**
   - **Condition:** Path is `/api/*`
   - **Action:** Forward to `finito-api-tg`

## 🐳 Step 7: Create ECS Infrastructure

### A. Create ECS Cluster
1. Go to **ECS > Clusters > Create cluster**
2. **Cluster name:** `finito-cluster`
3. **Infrastructure:** AWS Fargate (serverless)
4. **Create cluster**

### B. Create Task Definitions

#### API Task Definition
1. Go to **ECS > Task Definitions > Create new task definition**
2. **Task definition family:** `finito-api`
3. **Launch type:** AWS Fargate
4. **Operating system:** Linux/X86_64
5. **CPU:** 0.25 vCPU
6. **Memory:** 0.5 GB
7. **Task execution role:** `ecsTaskExecutionRole`
8. **Container:**
   - **Name:** `finito-api`
   - **Image URI:** `YOUR_ECR_REGISTRY/finito-api:latest`
   - **Port mappings:** 3001
   - **Environment variables:** 
     - **ValueFrom:** `arn:aws:secretsmanager:REGION:ACCOUNT:secret:finito/production/env-SUFFIX`
9. **Create task definition**

#### Web Task Definition
1. **Task definition family:** `finito-web`
2. **Container:**
   - **Name:** `finito-web`
   - **Image URI:** `YOUR_ECR_REGISTRY/finito-web:latest`
   - **Port mappings:** 3000
   - **Environment variables:** Same as API
3. **Create task definition**

#### Migrate Task Definition
1. **Task definition family:** `finito-migrate`
2. **Container:**
   - **Name:** `finito-migrate`
   - **Image URI:** `YOUR_ECR_REGISTRY/finito-migrate:latest`
   - **Environment variables:** Same as API
3. **Create task definition**

### C. Create ECS Services

#### API Service
1. Go to your ECS cluster
2. **Services > Create service**
3. **Launch type:** Fargate
4. **Task Definition:** `finito-api`
5. **Service name:** `finito-api-service`
6. **Desired tasks:** 2
7. **VPC:** Select your VPC
8. **Subnets:** Select private subnets
9. **Security group:** Select `finito-ecs-sg`
10. **Load balancer:** Select `finito-alb`
11. **Target group:** Select `finito-api-tg`
12. **Create service**

#### Web Service
1. **Service name:** `finito-web-service`
2. **Task Definition:** `finito-web`
3. **Target group:** Select `finito-web-tg`
4. **Create service**

## 🔄 Step 8: Configure GitHub Actions

### A. Set GitHub Secrets
Go to your GitHub repository > **Settings > Secrets and variables > Actions**

Add these secrets:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: Your AWS region (e.g., `us-east-1`)
- `ECS_MIGRATE_SUBNETS`: Private subnet IDs (comma-separated)
- `ECS_MIGRATE_SECURITY_GROUP`: The `finito-ecs-sg` security group ID

### B. Test Deployment
1. Push code to the `main` branch
2. Check **Actions** tab in GitHub
3. Monitor the deployment workflow
4. Verify services are running in ECS

## 🏁 Step 9: Final Verification

1. **Health Check:** Visit `https://your-alb-dns-name/api/health`
2. **Web Application:** Visit `https://your-alb-dns-name`
3. **Database:** Verify migrations ran successfully
4. **Logs:** Check CloudWatch logs for any errors

## 🔧 Troubleshooting

### Common Issues

#### ECS Tasks Not Starting
- Check CloudWatch logs for container errors
- Verify IAM role permissions
- Confirm secrets are accessible

#### ALB Health Check Failures
- Verify target group health check paths
- Check security group rules
- Confirm application is listening on correct port

#### Database Connection Issues
- Verify RDS endpoint in secrets
- Check security group rules
- Confirm database is accessible from ECS tasks

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster finito-cluster --services finito-api-service

# View task logs
aws logs tail /ecs/finito-api --follow

# Test database connectivity
aws rds describe-db-instances --db-instance-identifier finito-db
```

## 🎉 Success!

Your Finito Mail application is now deployed to AWS with:
- ✅ Zero-downtime deployments
- ✅ Automated migrations
- ✅ Horizontal scaling
- ✅ Production-grade security
- ✅ Comprehensive monitoring

The application will automatically deploy when you push to the `main` branch!