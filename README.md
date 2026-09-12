# HackQuest — Meeting Compiler

An AI-powered meeting extraction pipeline built on AWS and Next.js. This project automatically extracts decisions, action items, and context directly from raw meeting transcripts.

## 🏗️ Project Architecture

The repository is structured into three main directories, each with a specific responsibility:

### 1. `/frontend` (Next.js Application)
A modern React application built with Next.js 16 (App Router), Tailwind CSS, and shadcn/ui.
- **`app/`**: Contains the Next.js routing structure.
  - **`page.tsx`**: Multi-Meeting Dashboard (Action Board) that fetches all processed meetings from DynamoDB.
  - **`meetings/new/`**: The transcript upload interface.
  - **`meetings/[id]/review/`**: The Review screen for human-in-the-loop confirmation of AI extractions.
  - **`meetings/[id]/transcript/`**: A view of the raw transcript with evidence line highlights.
- **`components/`**: Reusable UI components, including the `ProposedItemCard` for reviewing AI extractions.
- **`lib/`**: Contains the API client and demo transcript mock data.

**To run the frontend locally:**
```bash
cd frontend
npm install
npm run dev
```
The app will be available at `http://localhost:3000`. Make sure your `.env.local` is configured with the `NEXT_PUBLIC_API_URL` of your deployed backend!

### 2. `/functions` (AWS Lambda Handlers)
Contains the core backend business logic executed by AWS Lambda (Node.js 20).
- **`serve-api/`**: A RESTful API built to interface between the frontend and DynamoDB. It handles fetching meetings, generating S3 presigned URLs for uploads, and managing the human-in-the-loop review state.
- **`extract-actions/`**: The core AI pipeline. It is triggered by EventBridge whenever a new transcript is uploaded to S3.
  - Connects directly to **Amazon Bedrock** (Mistral Large) to extract structured JSON data from raw meeting text.
  - Has a built-in mock fallback mechanism for demo purposes if AWS Bedrock throws an `Operation not allowed` error due to account restrictions.

### 3. `/infrastructure` (AWS CDK)
Infrastructure-as-Code (IaC) written in TypeScript using AWS Cloud Development Kit (CDK).
- **`lib/storage.ts`**: Provisions the core state infrastructure (S3 Bucket for raw transcripts, DynamoDB Table for application data).
- **`lib/api.ts`**: Deploys the API Gateway and the `serve-api` Lambda function.
- **`lib/extraction.ts`**: Deploys the EventBridge rule and the `extract-actions` Lambda function.

**To deploy the backend to AWS:**
```bash
cd infrastructure
npm install
npx cdk bootstrap
npx cdk deploy --all
```

## 🔄 End-to-End Workflow

1. **Upload**: A user uploads a raw meeting `.txt` transcript via the frontend dashboard.
2. **Presigned URL**: The `serve-api` Lambda generates a secure presigned URL to upload the file directly to S3.
3. **Event Trigger**: S3 fires an `Object Created` event to Amazon EventBridge.
4. **Extraction**: EventBridge triggers the `extract-actions` Lambda, which reads the transcript and asks Amazon Bedrock to extract action items.
5. **Storage**: The extracted action items are saved into DynamoDB with a status of `PENDING`.
6. **Review**: The user navigates to the Review tab to manually confirm, edit, or reject the AI-proposed actions.
7. **Action Board**: Once confirmed, the actions become finalized and visible on the main Dashboard.

## 🛠️ Built With
- **Frontend**: Next.js 16, React, TailwindCSS, Lucide Icons, shadcn/ui
- **Backend/IaC**: Node.js 20, AWS CDK, AWS SDK v3
- **AWS Services**: Amazon Bedrock, DynamoDB, S3, API Gateway, Lambda, EventBridge
