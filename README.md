# RivalLens --- Brand Sentiment & Competitor Analysis

RivalLens is a full-stack brand intelligence platform designed to help
businesses understand customer feedback, monitor brand sentiment, and
compare their performance with competitors. It brings brand mentions,
sentiment summaries, trends, review insights, and competitor analytics
into one dashboard.

> **Project status:** Development project. Features that depend on
> external platform APIs or AI processing require valid configuration
> and should be verified in the running application.

## Problem Statement

Businesses receive customer feedback across different digital platforms.
Manually reviewing this feedback makes it difficult to understand
customer opinion, identify recurring issues, track sentiment over time,
and compare brands consistently. RivalLens aims to organize this
feedback and provide a single interface for exploring customer mentions,
sentiment, trends, review aspects, and competitor performance.

## Objectives

-   Monitor mentions associated with tracked brands.
-   Summarize feedback using positive, negative, and neutral sentiment
    categories.
-   Search and filter customer mentions.
-   Compare a brand with selected competitors.
-   Visualize sentiment and mention trends over time.
-   Explore aspects of customer experience, such as delivery, pricing,
    or support, where supported by available data.
-   Provide AI-assisted insights where the corresponding backend
    functionality is configured.

## Key Features

### Brand Management

-   Add and manage tracked brands.
-   Select an active brand for analysis.
-   Associate competitors with a tracked brand.
-   Request competitor suggestions where supported by the backend.

### Dashboard

-   Display brand-level summary information.
-   View mention counts and sentiment indicators.
-   Explore recent mentions and aspect breakdowns.
-   Access AI-assisted recommendations where available.

### Mentions and Review Management

-   View customer mentions.
-   Search and filter reviews by supported criteria, such as source and
    sentiment.
-   Add a mention manually through the interface.
-   Review and manage stored feedback.

### Competitor Comparison

-   Compare a selected brand with configured competitors.
-   Review comparative sentiment and supported metrics.
-   Identify potential strengths and areas for improvement.

### Analytics and Review Intelligence

-   Explore sentiment and mention trends.
-   Use supported date-range filters.
-   View charts and aggregated metrics.
-   Display forecasts if the backend provides forecast results.
-   Explore sentiment associated with review aspects.
-   Support review-quality workflows where implemented by the backend.

### AI-Assisted Insights

The frontend includes interfaces for recommendations, question
answering, crisis alerts, root-cause analysis, and viral complaints.
Availability and analytical behavior depend on the corresponding backend
endpoints and processing modules.

## Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend                React                   Interactive user
                                                  interface

  Frontend tooling        Vite                    Development server and
                                                  build tooling

  Styling                 Tailwind CSS and        Interface styling
                          project CSS             

  Charts                  Recharts                Analytics
                                                  visualizations

  API communication       JavaScript Fetch API    HTTP requests to the
                                                  backend

  Backend                 Python and FastAPI      API endpoints and
                                                  application logic

  Data access             SQLAlchemy              Database models and
                                                  queries

  Database                SQLite in development   Local persistence

  Data integrations       Configured platform     Collecting available
                          APIs and ingestion      brand mentions
                          modules                 

  AI/NLP                  Configured processing   Sentiment and review
                          modules                 intelligence
  -----------------------------------------------------------------------

Confirm the exact NLP model, enabled external sources, and deployment
configuration from the current backend source.

## System Architecture

``` text
External data sources / manual entries
                 |
                 v
       FastAPI ingestion endpoints
                 |
                 v
    Validation and processing modules
                 |
                 v
      SQLAlchemy + SQLite database
                 |
                 v
           FastAPI REST API
                 |
          HTTP / JSON responses
                 |
                 v
        React + Vite frontend
                 |
                 v
 Dashboard | Mentions | Analytics | Comparison
```

The React frontend sends HTTP requests to FastAPI. The backend validates
requests, runs application logic, interacts with the database, and
returns JSON responses for the frontend to render.

## Project Structure

The frontend archive contains the React application. The backend is
maintained separately in the project repository. Adjust this example to
match the current repository layout.

``` text
RivalLens/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── schemas/
│   │   └── routers/
│   ├── requirements.txt
│   └── rivallens.db
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   └── ...
    ├── package.json
    └── vite.config.js
```

## Prerequisites

-   Python 3.11 or another version supported by backend dependencies.
-   Node.js and npm compatible with frontend dependencies.
-   Git.
-   API credentials for external data sources that you enable.

## Installation and Setup

### 1. Clone the repository

``` bash
git clone https://github.com/JanviPrajapati0210/RivalLens.git
cd RivalLens
```

If the repository contains a nested `RivalLens` directory, move into the
directory containing the backend and frontend folders.

### 2. Set up the backend

In PowerShell:

``` powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the location expected by the backend
configuration. Example development values:

``` env
DATABASE_URL=sqlite:///./rivallens.db
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
```

These are example values. Confirm the exact format expected by the
current settings code and add external API credentials only when
required. Never commit real secrets.

### 4. Start the backend

From the backend directory:

``` powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URL: `http://127.0.0.1:8000`

### 5. Install and start the frontend

Open a second terminal:

``` powershell
cd frontend
npm install
npm run dev
```

Vite commonly serves the dashboard at `http://localhost:5173`. Use the
URL printed in your terminal if the port differs.

## API Documentation

FastAPI commonly exposes interactive Swagger documentation at:

`http://127.0.0.1:8000/docs`

Previously used project endpoints include `GET /api/brands` and
ingestion routes under `/api/ingestion`. Use `/docs` to confirm the
current endpoint paths, request bodies, response formats, and status
codes.

## How It Works

1.  **Brand selection:** The user selects a brand to analyze.
2.  **Data collection:** Available ingestion integrations or manual
    entry provide mentions.
3.  **Processing:** The backend validates and processes incoming records
    using configured logic.
4.  **Persistence:** Records and related brand data are stored in the
    database.
5.  **Aggregation:** Backend services calculate supported summaries,
    sentiment distributions, aspect breakdowns, and trends.
6.  **Visualization:** The frontend requests API data and renders cards,
    charts, and review lists.
7.  **Comparison:** The user compares the active brand with configured
    competitors.

## Testing Checklist

Before a demonstration or release, verify:

-   The backend health check and brand-list endpoint work.
-   Brand creation validates input and handles duplicate names.
-   The frontend can communicate with the backend.
-   Manual mention submission and review filtering work.
-   Sentiment and aspect summaries match stored records.
-   Trend and date-range filters return expected results.
-   API errors are communicated clearly.
-   External integrations handle missing credentials, rate limits, and
    errors safely.

Run automated tests using the commands documented in the repository. Do
not report accuracy scores or test results unless they have been
measured in an actual run.

## Security Notes

-   Keep `.env` files and credentials out of version control.
-   Provide a `.env.example` with placeholders rather than real secrets.
-   Validate incoming requests on the backend.
-   Respect platform API terms, rate limits, permissions, and privacy
    requirements.
-   Use authentication, authorization, logging, and production-grade
    database configuration before public deployment.

## Limitations

-   Data coverage depends on available APIs, credentials, permissions,
    and rate limits.
-   Sentiment models can misinterpret sarcasm, mixed opinions, slang,
    and multilingual text.
-   Competitor comparisons depend on representative data.
-   Forecasts depend on the amount and quality of historical data.
-   AI recommendations should be reviewed before important business
    decisions.
-   Local SQLite configuration may need to be replaced for larger
    deployments.

## Future Enhancements

-   Improve multilingual sentiment analysis for English, Hindi,
    Gujarati, and Hinglish.
-   Add robust duplicate and spam detection with evaluation metrics.
-   Provide explainable aspect-level insights and evidence-linked
    recommendations.
-   Add configurable alerts for sudden negative-sentiment changes.
-   Validate historical trend analysis and forecasting performance.
-   Expand authorized data-source integrations.
-   Add role-based access control and audit logs.
-   Deploy with production database, monitoring, and secure secret
    management.

## Contributing

1.  Create a feature branch.
2.  Make focused changes and add tests where appropriate.
3.  Run available backend and frontend checks.
4.  Document new environment variables and setup steps.
5.  Submit a pull request describing the change.

## Authors

RivalLens is a collaborative project. 
-  Vidhi Patel - 24AIML048
-  Janvi Prajapati - 24AIML052

