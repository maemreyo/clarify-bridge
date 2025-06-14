# The Clarity Bridge

AI-powered Specification Generator that bridges the communication gap between Product Managers, Frontend Developers, and Backend Developers.

## Description

The Clarity Bridge is a platform that transforms high-level requirements into detailed, role-specific technical specifications. It uses AI to generate comprehensive documentation that serves as a single source of truth for development teams.

## Features

- **Context Ingestion**: Process unstructured inputs (text, screenshots) to extract context
- **Multi-View Generation**: Create role-specific views for PM, Frontend, and Backend
- **Diagram Generation**: Convert descriptions into visual diagrams using Mermaid.js
- **Quality Assurance**: Validate specifications for completeness and consistency
- **Collaboration**: Real-time comments, approvals, and change tracking
- **Team Management**: Workspace collaboration with role-based access control

## Technology Stack

- **Backend**: NestJS (Node.js & TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Bull / Redis
- **AI**: LangChain with multiple LLM providers
- **Vector Database**: Pinecone / ChromaDB
- **Real-time**: Socket.IO
- **Authentication**: Passport.js (JWT)

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm
- PostgreSQL
- Redis

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/clarify-bridge.git
   cd clarify-bridge
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Generate Prisma client
   ```bash
   pnpm prisma:generate
   ```

5. Start the development server
   ```bash
   pnpm start:dev
   ```

## Project Structure

The project follows a modular monolith architecture with three main layers:

- **Gateway Layer**: Entry points for external requests (API, WebSocket, Webhooks)
- **Application Layer**: Business logic modules (Specification, Context Ingestion, etc.)
- **Core Layer**: Foundational services (Auth, Database, LLM, etc.)

## License

[License information]

## Acknowledgments

- [Credits and acknowledgments]