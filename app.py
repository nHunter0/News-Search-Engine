from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from transformers import pipeline
import hashlib
import os
import json

app = Flask(__name__)
CORS(app)

VERBOSE = 0 
NEWS_API_KEY = '' # to get API key reg an account from https://newsapi.org/
NEWS_API_URL = 'https://newsapi.org/v2/top-headlines?country=au&apiKey=' + NEWS_API_KEY # targeted for AUS news
CACHE_FILE = 'article_cache.json'

# Load cached results if available
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, 'r') as f:
        cached_results = json.load(f)
else:
    cached_results = {}

# Fetch news articles
def fetch_news():
    response = requests.get(NEWS_API_URL)
    data = response.json()
    articles = data.get('articles', [])
    return [{'title': article['title'], 'content': article['description'] or article['content'] or '', 'url': article['url']} for article in articles]

# Preprocess documents
def preprocess_documents(documents):
    processed_docs = []
    titles = []
    for doc in documents:
        title = doc['title']
        content = (title + " ") * 3 + doc['content']  # Give more weight to the title
        processed_docs.append(content)
        titles.append(title)
    return processed_docs, titles

# Scrape the actual article content from the URL
def fetch_article_content(url):
    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.content, 'html.parser')
        paragraphs = soup.find_all('p')
        content = ' '.join([para.get_text() for para in paragraphs])
        return content
    except:
        return ''

# Generate a unique key for each article
def generate_article_key(article):
    key_data = f"{article['title']}_{article['url']}"
    return hashlib.md5(key_data.encode()).hexdigest()

# Save cached results to a file
def save_cache():
    with open(CACHE_FILE, 'w') as f:
        json.dump(cached_results, f)

# Load initial documents
documents = fetch_news()

# Load the sentiment analysis pipeline
sentiment_pipeline = pipeline('sentiment-analysis', model='nlptown/bert-base-multilingual-uncased-sentiment')

def analyze_sentiment(content):
    sentiment = sentiment_pipeline(content[:512])  # Use only the first 512 tokens for speed
    sentiment_score = sentiment[0]['score']
    sentiment_label = sentiment[0]['label']
    if sentiment_label in ["1 star", "2 stars"]:
        sentiment_label = "NEGATIVE"
    elif sentiment_label in ["4 stars", "5 stars"]:
        sentiment_label = "POSITIVE"
    else:
        sentiment_label = "NEUTRAL"
    return sentiment_score, sentiment_label

def get_first_50_words(text):
    words = text.split()
    return ' '.join(words[:50]) + '...' if len(words) > 50 else text

@app.route('/search', methods=['POST'])
def search():
    query = request.json.get('query')
    page = request.json.get('page', 1)
    page_size = 10
    include_all = request.json.get('include_all', False)

    # Preprocess documents and titles
    processed_docs, titles = preprocess_documents(documents)

    # Initialize and fit TF-IDF vectorizer
    tfidf_vectorizer = TfidfVectorizer(max_df=0.95, min_df=1, max_features=1000, stop_words='english')
    tfidf_matrix = tfidf_vectorizer.fit_transform(processed_docs + titles)  # Include titles in the fitting

    # Debugging: Print the shape of the TF-IDF matrix and the vocabulary
    if VERBOSE > 0:
        print("TF-IDF matrix shape:", tfidf_matrix.shape)
        print("TF-IDF vocabulary:", tfidf_vectorizer.vocabulary_)

    query_vector = tfidf_vectorizer.transform([query])

    # Debugging: Print the query vector
    if VERBOSE > 0:
        print("Query vector shape:", query_vector.shape)
        print("Query vector:", query_vector.toarray())

    cosine_similarities = np.dot(tfidf_matrix[:len(processed_docs)], query_vector.T).toarray().flatten()  # Use only the document part of the matrix

    # Debugging: Print cosine similarities
    if VERBOSE > 0:
        print("Cosine similarities for query '{}': {}".format(query, cosine_similarities))

    ranked_indices = cosine_similarities.argsort()[::-1]
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    results = []
    for idx in ranked_indices[start_index:end_index]:
        if query and not include_all and cosine_similarities[idx] == 0:
            continue  # Skip articles with TF-IDF score of 0 if not including all and there is a query
        doc = documents[idx]
        article_key = generate_article_key(doc)
        if article_key in cached_results:
            # Retrieve cached result but update TF-IDF score
            cached_result = cached_results[article_key]
            cached_result["score"] = cosine_similarities[idx]
            results.append(cached_result)
        else:
            if not doc['content']:
                doc['content'] = fetch_article_content(doc['url'])
            description = get_first_50_words(doc['content'])
            score, sentiment = analyze_sentiment(doc['content'])
            result = {
                "title": doc['title'],
                "description": description,
                "url": doc['url'],
                "score": cosine_similarities[idx],
                "sentiment_score": score,
                "sentiment": sentiment,
            }

            # Debugging: Print calculated TF-IDF score for each document
            if VERBOSE > 0:
                print("Document '{}' has TF-IDF score: {}".format(doc['title']))

            cached_results[article_key] = result
            results.append(result)
    save_cache()
    return jsonify(results)

@app.route('/refresh', methods=['GET'])
def refresh():
    global documents
    documents = fetch_news()
    return jsonify({"message": "News data refreshed", "sources": ["NewsAPI"], "count": len(documents)})

if __name__ == '__main__':
    app.run(debug=True)
