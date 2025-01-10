# Agustin Pizzeria - Voice-Enabled Ordering System

An AI-powered voice ordering system for a pizzeria that handles customer calls and manages orders through a real-time dashboard. Built with Cloudflare Workers, D1 Database, and ElevenLabs Voice AI.

## 🍕 Features

- **AI Voice Agent**: Processes incoming calls and takes orders naturally using ElevenLabs Voice AI
- **Real-time Dashboard**: Tracks orders status and details in a clean, responsive interface
- **Serverless Architecture**: Powered by Cloudflare Workers and D1 for scalable, low-latency performance
- **Structured Data Model**: Organized SQL schema for products, orders, and order items
- **Auto-refresh**: Dashboard updates every 30 seconds to show latest orders

## 🤖 How It Works

The system uses an AI-powered voice agent that greets customers with:

_"Welcome to Agustin Pizzeria! I can help you place an order for delivery or check the status of your existing order. How can I help you today?"_

The AI agent has access to several tools that allow it to:

- Check product availability in real-time
- Calculate order totals
- Create new orders
- Track order status

The agent follows a structured conversation flow:

1. Verifies menu availability before making suggestions
2. Handles dietary requests and preferences
3. Builds orders step by step
4. Suggests complementary items
5. Collects delivery information
6. Processes payment and creates order
7. Provides tracking information

## 🎯 AI Agent Prompt

````markdown
# Agustin Pizzeria Voice Assistant

## Overview

You are a voice assistant designed to efficiently handle pizza orders and order status inquiries for Agustin Pizzeria. It ensures accurate order processing by verifying menu availability and confirming details step by step.

## Core Principles

- Follow the customer's **preferred language**.
- Keep responses **concise and natural**.
- **Confirm** customer requests for accuracy.
- Guide customers **step by step**.
- Be **patient** and offer to **repeat information** if needed.
- **Handle errors gracefully**.
- **ALWAYS** verify menu availability before confirming.
- **DO NOT** ask the customer to wait while checking the menu; check internally and respond directly.

## Available Tools

1. `orders_get_products`: Retrieves available menu items and verifies availability.
2. `orders_calculate`: Calculates the total before finalizing the order.
3. `orders_create`: Submits and confirms the order.
4. `orders_get`: Retrieves the status of an order.

## 🛠️ Tech Stack

- **Backend**: Cloudflare Workers (Edge Computing)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Voice AI**: ElevenLabs API
- **Frontend**: HTML + Tailwind CSS
- **Development**: Wrangler CLI

## 📋 Product Categories

The system manages various product categories:

- Traditional Pizzas
- Specialty Pizzas
- Beverages
- Desserts

## 💻 Dashboard Features

- Order tracking with unique IDs
- Real-time order status updates
- Detailed order information including items and quantities
- Customer delivery addresses
- Color-coded status indicators
- Automatic refresh every 30 seconds

## 🔄 Order Status Flow

1. **New**: Order just received
2. **Preparing**: Kitchen processing
3. **Delivering**: On the way
4. **Completed**: Delivered to customer
5. **Cancelled**: Order cancelled

## ⚡ Cloudflare Setup

### Prerequisites

1. Cloudflare Account
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Domain connected to Cloudflare (for production)

### D1 Database Setup

```bash
# Login to Cloudflare
wrangler login

# Create D1 Database
wrangler d1 create pizzeria-db

# This will output something like:
# Created database 'pizzeria-db' with id: 0427478b-560f-4e7f-a472-7b79ba358257
# Add the following to your wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "pizzeria-db"
# database_id = "0427478b-560f-4e7f-a472-7b79ba358257"

# Initialize database with schema
wrangler d1 execute pizzeria-db --file=./schema.sql

# For production database
wrangler d1 execute pizzeria-db --file=./schema.sql --remote
```
````

### Worker Setup

```bash
# Create new worker project
wrangler init pizzeria-worker

# Configure wrangler.toml with D1 binding
# Example in repository

# Development
wrangler dev

# Deploy
wrangler deploy
```

### Environment Variables

Required variables in wrangler.toml:

```toml
name = "agustin-pizzeria"
main = "src/index.js"
compatibility_date = "2024-01-06"

[[d1_databases]]
binding = "DB"
database_name = "pizzeria-db"
database_id = "your-database-id"
```

### Testing Setup

```bash
# Local development with remote DB
wrangler dev --remote

# Test database queries
wrangler d1 execute pizzeria-db "SELECT * FROM products"
```

## 🚀 Development

```bash
# Install dependencies
npm install

# Initialize database
npm run init-db

# Run development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## 📝 API Endpoints

- `GET /api/products`: List all available products
- `POST /api/orders/calculate`: Calculate order total
- `POST /api/orders`: Create new order
- `GET /api/orders/:id`: Get specific order details
- `GET /dashboard`: View orders dashboard
