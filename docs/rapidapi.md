# RapidAPI Domain WHOIS Lookup API Documentation

This document summarizes the key details for integrating the RapidAPI Domain WHOIS Lookup API.

## Overview

The service provides WHOIS data for any registered domain name via a RESTful API.

-   **Endpoint**: `https://domain-whois-lookup-api.p.rapidapi.com/whois`
-   **Method**: `GET`
-   **Response Format**: `JSON`

## Authentication

Authentication is required for every request and is handled via custom HTTP headers.

-   **Host Header**: `x-rapidapi-host: domain-whois-lookup-api.p.rapidapi.com`
-   **API Key Header**: `x-rapidapi-key: YOUR_RAPIDAPI_KEY`

You must subscribe to the API on the [RapidAPI Marketplace](https://rapidapi.com/is-this-thing-on/api/domain-whois-lookup-api) to get your key.

## Request Parameters

-   `domain_name` (string, **required**): The domain name to look up, passed as a query string parameter.

## Example Request (cURL)

```bash
curl --request GET \
	--url 'https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=example.com' \
	--header 'x-rapidapi-host: domain-whois-lookup-api.p.rapidapi.com' \
	--header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'
```

## Response Data

A successful response returns a JSON object with the following key fields:

-   `name`: The name of the domain.
-   `creation_date`: The date when the domain was first registered (ISO 8601 format).
-   `expiration_date`: The date when the domain registration will expire (ISO 8601 format).
-   `registrar`: The name of the domain registrar.
-   `registrant`: The name of the domain registrant.
-   `email`: The email address of the domain registrant.

## Error Handling

The API uses standard HTTP status codes.

-   **`400 - Bad Request`**: An invalid domain name was provided. The response body will contain an error message.
    ```json
    { "error": "Invalid domain name" }
    ```
-   **`404 - Not Found`**: The domain is not found, which indicates it is available for registration. The response body will be:
    ```json
    { "status": "Available for registration" }
    ```

## Rate Limiting

-   The API limits requests to 1000 requests per day per IP address on the free (BASIC) plan.
