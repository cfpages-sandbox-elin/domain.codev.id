# apilayer.com Whois API Documentation

This document summarizes the key details for integrating the apilayer.com Whois API.

## Overview

The service provides WHOIS data for domain names via a RESTful API.

-   **Endpoint**: `https://api.apilayer.com/whois/check`
-   **Method**: `GET`
-   **Response Format**: `JSON`

## Authentication

Authentication is required for every request and is handled via a custom HTTP header.

-   **Header Name**: `apikey`
-   **Usage**: All requests must include the header `apikey: YOUR_API_KEY`.
-   **Security**: API keys must be kept secure and should not be exposed in client-side code. Use environment variables on the server or build environment.

## Request Parameters

-   `domain` (string, **required**): The domain name to look up. This is passed as a query string parameter.

## Example Request (cURL)

```bash
curl --location --request GET 'https://api.apilayer.com/whois/check?domain=example.com' \
--header 'apikey: YOUR_API_KEY'
```

## Rate Limiting

-   Each subscription plan has daily and monthly rate limits.
-   When a limit is reached, the API will respond with an `HTTP 429 Too Many Requests` status code.
-   The response body for a rate-limited request will be:
    ```json
    {
        "message": "You have exceeded your daily/monthly API rate limit..."
    }
    ```
-   You can programmatically check your remaining limits via the following response headers sent with every successful request:
    -   `x-ratelimit-limit-month`: Your monthly request quota.
    -   `x-ratelimit-remaining-month`: Requests remaining this month.
    -   `x-ratelimit-limit-day`: Your daily request quota.
    -   `x-ratelimit-remaining-day`: Requests remaining today.

## Error Codes

The API uses standard HTTP status codes to indicate success or failure. A non-200 response indicates an error, and the JSON body will contain a `message` field with details.

-   **`400 - Bad Request`**: A required parameter (like `domain`) is missing or invalid.
-   **`401 - Unauthorized`**: The provided `apikey` is missing or invalid.
-   **`404 - Not Found`**: The requested resource does not exist.
-   **`429 - Too many requests`**: You have exceeded your API rate limit.
-   **`5xx - Server Error`**: An error occurred on apilayer's servers.
