variable "environment" { type = string }
variable "region" { type = string }
variable "domain" { type = string }

# ECS/Fargate example for app hosting
resource "aws_ecs_cluster" "inkocaller" {
  name = "inkocaller-${var.environment}-${var.region}"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "inkocaller-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  
  container_definitions = jsonencode([{
    name  = "inkocaller"
    image = "inkocaller:latest"
    portMappings = [{ containerPort = 3000 }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "REGION", value = var.region }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group = "/ecs/inkocaller-${var.environment}"
        awslogs-region = var.region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}

output "url" {
  value = "https://${var.domain}"
}
