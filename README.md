# 📊 DataInsight AI

> **AI-powered data analytics platform for uploading, cleaning, exploring, visualizing, and analyzing datasets — all from one dashboard.**

DataInsight AI is a full-stack analytics platform designed to simplify the complete data analysis workflow.

Users can upload datasets and use an interactive dashboard to:

- 📁 Upload CSV / Excel datasets
- 🔎 Search uploaded datasets
- 📋 Preview dataset records
- 🧹 Clean datasets
- 📊 Perform Exploratory Data Analysis (EDA)
- 📈 Generate interactive charts
- 🧮 Analyze correlations
- 🚨 Detect outliers
- 🤖 Generate AI-powered insights
- 🎯 Perform Root Cause Analysis
- 🧠 Train Machine Learning models
- 💡 Get AI recommendations
- 🔮 Perform What-If analysis
- 📄 Generate analytical reports
- 🔌 Connect external data sources

---

# 🚀 Features

## 📁 Dataset Upload

Upload datasets directly from the frontend.

Supported formats:

- CSV
- XLS
- XLSX

The frontend sends the dataset to the Node.js backend, which forwards it to the Python ML service for processing.

---

## 📊 Analytics Dashboard

After uploading a dataset, users get a centralized analytics dashboard containing:

- Dataset statistics
- Row and column counts
- Missing-value analysis
- Duplicate-row analysis
- Column profiling
- Outlier information
- Distribution analysis
- Correlation analysis
- Interactive charts
- AI-generated insights

---

## 🔎 Dataset Search

DataInsight AI includes a global dataset search.

Currently searchable dataset information includes:

- Filename
- Source table
- Database
- Schema
- Resource

Search results directly navigate to the selected dataset dashboard.

---

## 🧹 Data Cleaning

Users can clean datasets from the dashboard.

The cleaning pipeline can be used to process issues such as:

- Missing values
- Duplicate records
- Invalid data
- Data inconsistencies

The cleaned dataset can then be used for further analytics and machine-learning workflows.

---

## 📈 Exploratory Data Analysis

The platform provides automated EDA including:

- Numerical statistics
- Categorical analysis
- Missing-value analysis
- Distribution analysis
- Correlation analysis
- Outlier detection
- Column-level profiling

---

## 📊 Data Visualization

The dashboard supports multiple visualization types, including:

- Histograms
- Bar charts
- Line charts
- Scatter plots
- Box plots
- Correlation heatmaps
- Category distributions
- Trend analysis

Charts are generated from the actual uploaded dataset.

---

## 🤖 AI-Powered Insights

DataInsight AI integrates AI capabilities to help users understand their datasets.

The AI layer can provide:

- Key observations
- Important trends
- Potential anomalies
- Data-quality observations
- Business-oriented insights

---

## 🎯 Root Cause Analysis

The Root Cause Analysis module helps analyze relationships between variables and identify factors that may contribute to an observed outcome.

The platform includes contribution-style visualizations to make these relationships easier to understand.

---

## 🧠 Machine Learning

The platform includes an ML module for building predictive models from datasets.

The ML workflow is designed to support:

- Feature selection
- Model training
- Prediction
- Model evaluation
- ML-based insights

The machine-learning functionality is handled by the Python ML service.

---

## 💡 AI Recommendations

DataInsight AI can generate recommendations based on the analysis performed on the dataset.

Recommendations are intended to help users move from:

**Data → Insights → Decisions**

---

## 🔮 What-If Analysis

The What-If module allows users to explore hypothetical changes in data and understand potential outcomes.

This helps users experiment with possible scenarios before making business decisions.

---

## 📄 Reports

The Reports module is designed to provide a consolidated view of analytical results.

Reports can combine:

- Dataset information
- Key metrics
- Visualizations
- Analytical findings
- AI insights

---

## 🔔 Notifications

The application includes a notification/activity system based on dataset activity.

Examples include:

- Dataset uploaded
- Dataset cleaned

Notification entries can link directly to the relevant dataset dashboard.

---

## 🔌 Data Connectors

The platform architecture supports multiple dataset sources.

Supported source types in the backend model include:

- Upload
- REST API
- MySQL
- PostgreSQL
- Google Sheets

---

# 🏗️ System Architecture

DataInsight AI uses a three-layer architecture:

```text
┌─────────────────────────────┐
│        Frontend             │
│     React + Vite            │
│     Tailwind CSS            │
└──────────────┬──────────────┘
               │
               │ REST API
               ▼
┌─────────────────────────────┐
│        Node.js Backend       │
│      Express + MongoDB       │
│                             │
│ Authentication              │
│ Dataset APIs                │
│ Search                      │
│ Notifications               │
│ Business Logic              │
└──────────────┬──────────────┘
               │
               │ HTTP
               ▼
┌─────────────────────────────┐
│       Python ML Service      │
│         FastAPI              │
│                             │
│ Data Ingestion              │
│ Data Cleaning               │
│ EDA                         │
│ Visualization Data          │
│ Outlier Analysis            │
│ Machine Learning            │
│ AI / Analytics Processing   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      Dataset Storage         │
│                             │
│ Local Parquet Files          │
│ MongoDB Metadata             │
└─────────────────────────────┘
