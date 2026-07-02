# Face-Findr: Beauty Discovery Web Application - Project Summary v1

## Project Overview

This is a **full-stack web application** called **Face-Findr** - an interactive beauty product discovery tool that helps users explore makeup products from Sephora and Ulta. The application uses a creative visual interface where users click on different parts of a face image to discover products in four beauty categories.

**Live Application**: https://beauty-application.herokuapp.com/

---

## Core Technologies

### Frontend Stack
- HTML5, CSS3, Vanilla JavaScript
- **p5.js** - Creative coding library (includes voice synthesis)
- **D3.js** - DOM manipulation and data handling
- **Plotly.js** - Interactive data visualizations
- **Bootstrap 3 & 4** - Responsive layout

### Backend Stack
- **Node.js + Express.js** - Web server
- **Flask (Python)** - Data processing
- **PostgreSQL** - Product database

### Deployment
- **Heroku** - Cloud hosting platform

---

## Key Features

### 1. Interactive Face Map
Users click on areas of a face image to select product categories (foundation, blush, eyeshadow, eyeliner)

### 2. Voice-Activated Instructions
Uses p5.speech to provide audio guidance with UK female accent

### 3. Dynamic Product Visualization
- Product dropdowns that populate based on category selection
- Top 10 products by price (horizontal bar charts)
- Top 10 products by rating (horizontal bar charts)
- Creative rating display using repeated product icons

### 4. Product Details
- Brand and product name
- Price information
- Visual rating display
- Direct purchase links to retailers

---

## Project Structure

```
Main Files:
├── index.html - Single-page application interface
├── server.js - Express web server
├── app.py - Flask backend for data processing
├── makeup_data.json - Consolidated product data
└── Procfile - Heroku deployment configuration

Key Directories:
├── js/ - Frontend JavaScript (makeuppage.js, visualizations)
├── static/css/ - Custom styling
├── static/images/ - Face images, category views, rating icons
├── prod_data/ - 12 CSV files with processed product data
├── raw_data/ - Original scraped data from Sephora & Ulta
└── SQL/ - Database schemas and queries
```

---

## Data Pipeline

The application processes data from two major beauty retailers:

- **Raw Data**: Scraped from Sephora (~2.3MB) and Ulta (~1.4MB)
- **Processed Data**: 12 CSV files containing top/bottom 10 products across 4 categories
- **Format**: Flask converts CSV to JSON, served to frontend for visualization

---

## Product Categories

Each category has dedicated visual assets and data:

- **Foundation** (full face area)
- **Blush** (cheek areas)
- **Eyeshadow** (eyelid areas)
- **Eyeliner** (eye line areas)

---

## User Flow

1. User loads page → Face image displayed
2. User clicks facial area → Image changes to show selected category
3. Product dropdown populates → Charts display top 10 products
4. User selects product → Detailed info displays with rating icons and purchase link

---

## Data Structure

### Database Schema (PostgreSQL)
Fields: index, brand, product, product_type, price, rating, details, ingredients, url, store

### CSV File Structure (prod_data/)
- 12 CSV files total (3 metrics × 4 categories)
- Each row contains: index, brand, product, price, rating

### JSON Structure (makeup_data.json)
```javascript
{
  "top10_blush_price.csv": {
    "0": { product, brand, price, rating, product_type, url, ... },
    "1": { ... }
  },
  "top10_blush_rating.csv": { ... },
  // ... other categories
}
```

---

## Project Intent

The overall intent is to create an **engaging, visual way to discover beauty products** that combines:

- **Interactive UI design** - Clickable face map for intuitive navigation
- **Data visualization** - Price/rating comparisons across products
- **Practical utility** - Product information and purchase links
- **Creative elements** - Voice guidance, icon-based ratings

This appears to be a portfolio project demonstrating skills in:
- Full-stack web development
- Data processing and ETL pipelines
- API integration
- Creative web design and user experience
- Data visualization

---

## Technical Highlights

### Strengths
- Clean separation of concerns (frontend/backend)
- Responsive Bootstrap grid layout
- Dynamic data-driven visualization
- Interactive UX with immediate visual feedback
- Multiple data sources consolidated into single interface

### Data Processing
- Web scraping from major beauty retailers
- CSV processing and data cleaning (Jupyter notebooks)
- PostgreSQL database for structured storage
- JSON API for frontend consumption

### Deployment Architecture
- Node.js Express serves static files
- Flask handles data processing endpoints
- PostgreSQL database backend
- Heroku cloud deployment

---

## Future Enhancement Opportunities

Based on README notes, potential improvements include:
- User input for allergies, skin type, hair type
- Expand product range beyond 4 categories
- More curated product recommendations
- Real-time product data updates
- User reviews and ratings integration

---

**Document Version**: 1.0
**Generated**: 2026-07-02
**Repository**: face-findr
