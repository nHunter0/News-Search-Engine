import React, { useState } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  ListGroup,
  InputGroup,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faArrowDown,
  faSync,
} from "@fortawesome/free-solid-svg-icons";

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderBy, setOrderBy] = useState("tfidf");
  const [orderDirection, setOrderDirection] = useState("desc");
  const [connectedAPIs, setConnectedAPIs] = useState([]);
  const [newsCount, setNewsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const refreshNews = async () => {
    setLoading(true); // Start loading
    const response = await axios.get("http://localhost:5000/refresh");
    setConnectedAPIs(response.data.sources);
    setNewsCount(response.data.count);
    setLoading(false); // End loading
  };

  const handleSearch = async (event) => {
    event.preventDefault(); // Prevent form submission
    setLoading(true); // Start loading
    const response = await axios.post("http://localhost:5000/search", {
      query,
      page: 1,
      include_all: !query,
    });
    let sortedResults = response.data;
    if (orderBy === "tfidf") {
      sortedResults = sortedResults.sort((a, b) => b.score - a.score);
    } else if (orderBy === "sentiment_score") {
      sortedResults = sortedResults.sort(
        (a, b) => b.sentiment_score - a.sentiment_score
      );
    } else if (orderBy === "sentiment") {
      sortedResults = sortedResults.sort((a, b) =>
        a.sentiment.localeCompare(b.sentiment)
      );
    }
    if (orderDirection === "asc") {
      sortedResults = sortedResults.reverse();
    }
    setResults(sortedResults);
    setLoading(false); // End loading
    setPage(1); // Reset page to 1
  };

  const loadMore = async () => {
    setLoadingMore(true); // Start loading more
    const nextPage = page + 1;
    const response = await axios.post("http://localhost:5000/search", {
      query,
      page: nextPage,
      include_all: true,
    });
    let newResults = response.data;
    if (orderBy === "tfidf") {
      newResults = newResults.sort((a, b) => b.score - a.score);
    } else if (orderBy === "sentiment_score") {
      newResults = newResults.sort(
        (a, b) => b.sentiment_score - a.sentiment_score
      );
    } else if (orderBy === "sentiment") {
      newResults = newResults.sort((a, b) =>
        a.sentiment.localeCompare(b.sentiment)
      );
    }
    if (orderDirection === "asc") {
      newResults = newResults.reverse();
    }
    setResults([...results, ...newResults]);
    setLoadingMore(false); // End loading more
    setPage(nextPage); // Update page
  };

  const loadAll = async () => {
    setLoading(true); // Start loading
    const response = await axios.post("http://localhost:5000/search", {
      query,
      page: 1,
      include_all: true,
    });
    let sortedResults = response.data;
    if (orderBy === "tfidf") {
      sortedResults = sortedResults.sort((a, b) => b.score - a.score);
    } else if (orderBy === "sentiment_score") {
      sortedResults = sortedResults.sort(
        (a, b) => b.sentiment_score - a.sentiment_score
      );
    } else if (orderBy === "sentiment") {
      sortedResults = sortedResults.sort((a, b) =>
        a.sentiment.localeCompare(b.sentiment)
      );
    }
    if (orderDirection === "asc") {
      sortedResults = sortedResults.reverse();
    }
    setResults(sortedResults);
    setLoading(false); // End loading
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleSearch(event);
    }
  };

  const toggleOrderDirection = () => {
    setOrderDirection(orderDirection === "asc" ? "desc" : "asc");
  };

  return (
    <Container>
      <Row className="justify-content-md-center">
        <Col md="8">
          <h1 className="my-4 text-center pt-3">Simple Search Engine</h1>
          <Form onSubmit={handleSearch}>
            <Form.Group controlId="searchQuery" className="mb-3">
              <Form.Control
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search..."
                className="shadow-sm"
              />
            </Form.Group>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Button
                variant="info"
                onClick={refreshNews}
                className="me-2 shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  />
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSync} /> Refresh News
                  </>
                )}
              </Button>
              <span>
                <strong>Connected APIs:</strong> {connectedAPIs.join(", ")}
              </span>
              <span>
                <strong>Total News Articles:</strong> {newsCount}
              </span>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <InputGroup style={{ maxWidth: "300px" }}>
                <InputGroup.Text>Order By:</InputGroup.Text>
                <Form.Control
                  as="select"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value)}
                >
                  <option value="tfidf">TF-IDF Score</option>
                  <option value="sentiment_score">Sentiment Score</option>
                  <option value="sentiment">Sentiment</option>
                </Form.Control>
                <Button
                  variant="outline-secondary"
                  onClick={toggleOrderDirection}
                >
                  {orderDirection === "asc" ? (
                    <FontAwesomeIcon icon={faArrowUp} />
                  ) : (
                    <FontAwesomeIcon icon={faArrowDown} />
                  )}
                </Button>
              </InputGroup>
              <div className="d-grid gap-2">
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? (
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                    />
                  ) : (
                    "Search"
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={loadAll}
                  disabled={loading}
                >
                  {loading ? (
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                    />
                  ) : (
                    "Load All"
                  )}
                </Button>
              </div>
            </div>
          </Form>
          <ListGroup className="mt-4 shadow-sm">
            {results.map((result, index) => (
              <ListGroup.Item key={index} className="mb-2">
                <h4>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-decoration-none"
                  >
                    {result.title}
                  </a>
                </h4>
                <p className="mb-1">
                  <strong>TF-IDF Score:</strong> {result.score.toFixed(4)}
                </p>
                <p className="mb-1">
                  <strong>Sentiment Score:</strong>{" "}
                  {result.sentiment_score.toFixed(4)}
                </p>
                <p className="mb-1">
                  <strong>Sentiment:</strong> {result.sentiment}
                </p>
                <p>{result.description}</p>
              </ListGroup.Item>
            ))}
          </ListGroup>
          <div className="d-flex justify-content-center mt-3">
            <Button
              variant="secondary"
              onClick={loadMore}
              disabled={loadingMore}
              className="shadow-sm"
            >
              {loadingMore ? (
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Search;
