#!/bin/bash
# Vinops Automation Deployment Script
# Deploys photo scraper and ETL services

set -e

echo "========================================================================"
echo "Vinops Automation Deployment"
echo "========================================================================"
echo ""

# Create log directory
echo "Creating log directory..."
mkdir -p /var/log/vinops
chmod 755 /var/log/vinops

# Create data directory for CSV storage
echo "Creating data directories..."
mkdir -p /var/data/vinops/raw/copart
chmod 755 /var/data/vinops/raw/copart

# Deploy photo scraper service
echo ""
echo "Deploying photo scraper service..."
cp /root/Vinops-project/deploy/vinops-photo-scraper.service /etc/systemd/system/
cp /root/Vinops-project/deploy/vinops-photo-scraper.timer /etc/systemd/system/

# Deploy ETL service
echo "Deploying ETL service..."
cp /root/Vinops-project/deploy/vinops-etl.service /etc/systemd/system/
cp /root/Vinops-project/deploy/vinops-etl.timer /etc/systemd/system/

# Reload systemd
echo ""
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable services
echo "Enabling services..."
systemctl enable vinops-photo-scraper.timer
systemctl enable vinops-etl.timer

# Start timers
echo ""
echo "Starting timers..."
systemctl start vinops-photo-scraper.timer
systemctl start vinops-etl.timer

# Show status
echo ""
echo "========================================================================"
echo "Deployment Complete"
echo "========================================================================"
echo ""
echo "Service Status:"
echo "---------------"
systemctl status vinops-photo-scraper.timer --no-pager || true
echo ""
systemctl status vinops-etl.timer --no-pager || true

echo ""
echo "Next scheduled runs:"
echo "--------------------"
systemctl list-timers vinops-* --no-pager

echo ""
echo "Logs available at:"
echo "------------------"
echo "  Photo Scraper: /var/log/vinops/photo-scraper.log"
echo "  ETL: /var/log/vinops/etl.log"
echo ""
echo "Manual commands:"
echo "----------------"
echo "  Start photo scraper now:  systemctl start vinops-photo-scraper.service"
echo "  Start ETL now:            systemctl start vinops-etl.service"
echo "  View logs:                tail -f /var/log/vinops/photo-scraper.log"
echo "  Stop services:            systemctl stop vinops-photo-scraper.timer vinops-etl.timer"
echo ""
