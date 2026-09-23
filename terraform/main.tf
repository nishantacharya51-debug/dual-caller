terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "production"
}

variable "regions" {
  description = "List of regions for multi-region deployment (12-region capable)"
  type        = list(string)
  default     = ["us-east-1"] # Start with 1, scale to 12 via modules
}

variable "turn_secret" {
  description = "TURN static auth secret"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Domain name"
  type        = string
  default     = "inkocaller.app"
}

# Provider abstraction - AWS example
provider "aws" {
  region = var.regions[0]
}

module "app" {
  source = "./modules/app"
  environment = var.environment
  region = var.regions[0]
  domain = var.domain
}

module "turn" {
  source = "./modules/turn"
  environment = var.environment
  turn_secret = var.turn_secret
}

module "db" {
  source = "./modules/db"
  environment = var.environment
}

# 12-region architecture documentation
# To add regions, duplicate module calls:
# module "app_eu_west" { source = "./modules/app" region = "eu-west-1" ... }
# module "app_ap_south" { source = "./modules/app" region = "ap-south-1" ... }
# Geographic routing via Route53 latency records or Cloudflare Load Balancer

output "app_url" {
  value = module.app.url
}

output "turn_servers" {
  value = module.turn.servers
}

# Cost estimation for 10k concurrent calls
# See docs/cost-model.md for detailed breakdown
