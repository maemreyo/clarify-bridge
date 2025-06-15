# The Clarity Bridge 🌉

AI-powered Specification Generator that bridges the communication gap between Product Managers, Frontend Developers, and Backend Developers.

## 🚀 Overview

The Clarity Bridge transforms high-level requirements into detailed, role-specific technical specifications using AI. It provides:

- **Multi-View Generation**: Separate views for PM, Frontend, and Backend roles
- **Visual Diagrams**: Automatic generation of flowcharts, ER diagrams, and sequence diagrams
- **Quality Assurance**: AI-powered validation and consistency checking
- **Real-time Collaboration**: Comments, reviews, and live editing
- **External Integrations**: Sync with Jira, Linear, GitHub, Notion, and Slack

## 🏗️ Architecture

The project follows a **Modular Monolith** architecture with three main layers:

```
src/
├── gateway/          # Entry points (API, WebSocket, Webhooks)
├── application/      # Business logic modules
└── core/            # Foundation services
```

## 📋 Prerequisites

- Node.js (v18+)
- pnpm (v8+)
- PostgreSQL (v14+)
- Redis (v6+)
- At least one AI provider API key (OpenAI, Google AI, or Anthropic)

## 🛠️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-org/the-clarity-bridge.git
cd the-clarity-bridge
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Environment setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# Required: DATABASE_URL, JWT_SECRET, and at least one AI provider API key
```

### 4. Database setup

```bash
# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# (Optional) Seed the database with sample data
pnpm prisma:seed
```

### 5. Start the application

```bash
# Development mode with hot reload
pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

### 6. Access the application

- API: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs
- WebSocket: ws://localhost:3000/realtime
- Health Check: http://localhost:3000/health

## 🔧 Configuration

### Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- AI Provider (at least one):
  - `OPENAI_API_KEY`: OpenAI API key
  - `GOOGLE_AI_API_KEY`: Google AI API key
  - `ANTHROPIC_API_KEY`: Anthropic API key

### Optional Services

- **Redis**: Required for job queues and caching
- **Stripe**: For payment processing
- **Email**: SMTP configuration for notifications
- **Vector DB**: Pinecone for semantic search
- **External Integrations**: API keys for Jira, Linear, etc.

## 📚 API Documentation

Once the application is running, visit http://localhost:3000/api/docs for interactive Swagger documentation.

### Key Endpoints

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/specifications` - Create specification
- `GET /api/v1/specifications/:id` - Get specification details
- `POST /api/v1/specifications/:id/generate` - Generate AI content
- `GET /api/v1/health` - System health check

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Test coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

## 🚢 Deployment

### Docker

```bash
# Build Docker image
docker build -t clarity-bridge .

# Run with Docker Compose
docker-compose up -d
```

### Manual Deployment

1. Build the application: `pnpm build`
2. Set production environment variables
3. Run migrations: `pnpm prisma:migrate:deploy`
4. Start the application: `pnpm start:prod`

## 🔍 Monitoring

The application includes built-in monitoring:

- **Health Checks**: `/health` endpoint with detailed service status
- **Metrics**: Performance tracking and usage analytics
- **Logging**: Structured logs with Winston
- **Error Tracking**: Automatic error reporting

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- AI powered by [LangChain](https://langchain.com/)
- Database ORM by [Prisma](https://www.prisma.io/)

---

**Ready to bridge the gap between ideas and implementation!** 🌉✨
