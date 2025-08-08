# WhoisFreaks.com WHOIS API Documentation

This document summarizes the key details for integrating the WhoisFreaks.com live WHOIS API.

## Overview

The service provides real-time ("live") WHOIS data for a given domain name via a RESTful API.

-   **Endpoint**: `https://api.whoisfreaks.com/v1.0/whois`
-   **Method**: `GET`
-   **Response Formats**: `JSON` (default) or `XML`.

## Authentication

Authentication is required for every request and is handled via a query parameter.

-   **Parameter Name**: `apiKey`
-   **Usage**: All requests must include `apiKey=YOUR_API_KEY` in the URL's query string.
-   **Security**: You can reset your API key from the billing dashboard if it is ever compromised.

## Key Request Parameters

### Required

-   `apiKey` (string): Your personal API key from the WhoisFreaks dashboard.
-   `whois` (string): Must be set to the value `live` for real-time lookups.
-   `domainName` (string): The domain name you want to query.

### Optional

-   `format` (string): The desired response format.
    -   **Values**: `JSON` | `XML`
    -   **Default**: `JSON`

## Example Request (GET)

To get live WHOIS data for `whoisfreaks.com` in the default JSON format:

```
https://api.whoisfreaks.com/v1.0/whois?apiKey=YOUR_API_KEY&whois=live&domainName=whoisfreaks.com
```

## Response Data

A successful response (HTTP 200) returns a JSON object. Key fields to look for include:

-   `status`: `true` on success.
-   `domain_name`: The domain that was queried.
-   `domain_registered`: `"yes"` or `"no"`.
-   `create_date`: Registration date (e.g., "2019-03-19").
-   `expiry_date`: Expiration date (e.g., "2025-03-19").
-   `domain_registrar`: An object containing...
    -   `registrar_name`: The name of the registrar (e.g., "NAMECHEAP INC").
-   `error`: If the `status` is `false`, this object may contain an error message.

## Error Handling

The API uses standard HTTP status codes to indicate issues. For example:

-   **`400`**: Invalid domain name.
-   **`401`**: Invalid or inactive API key, or insufficient credits.
-   **`408`**: Unable to fetch WHOIS data for the domain.
-   **`429`**: Maximum request limit reached.