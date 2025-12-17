#!/bin/bash

# Create all service directories
for service in security-service ml-service device-gateway cdss-engine api-gateway; do
  mkdir -p services/$service
done

# You'll need to manually copy the files above into each directory
echo "Directories created. Now copy the files from the artifact above."
