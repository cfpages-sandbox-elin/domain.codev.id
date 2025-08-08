# WhoisXMLAPI.com WHOIS Service Documentation

This document summarizes the key details for integrating the WhoisXMLAPI.com WHOIS Web Service.

## Overview

The service provides WHOIS registration data for domain names, IP addresses, and email addresses via a RESTful API.

-   **Endpoint**: `https://www.whoisxmlapi.com/whoisserver/WhoisService`
-   **Methods**: Supports `GET` (with query parameters) and `POST` (with a JSON body).
-   **Response Formats**: `JSON` or `XML`.

## Authentication

Authentication is required for every request.

-   **Method 1 (Recommended): Query Parameter**
    -   Add `apiKey=YOUR_API_KEY` to the request URL.
    -   Example: `.../WhoisService?apiKey=at_xxx&domainName=google.com`

-   **Method 2: Authorization Header**
    -   Use the `Authorization` header with a Bearer token.
    -   Format: `Authorization: Bearer YOUR_API_KEY`

> The `apiKey` query parameter has higher priority and will be used if both methods are present.

## Key Request Parameters

### Required

-   `domainName` (string): The domain name, IP address, or email to look up.

### Important Optional Parameters

-   `outputFormat` (string): The desired response format.
    -   **Value**: `JSON` (Recommended for web apps)
    -   **Default**: `XML`
-   `da` (integer): Checks domain availability.
    -   **Value**: `2` (Slower but more accurate check)
    -   **Default**: `0`
    -   The result is in the `WhoisRecord.domainAvailability` field (`AVAILABLE` or `UNAVAILABLE`).
-   `_hardRefresh` (integer): Forces a real-time lookup, bypassing the cache.
    -   **Value**: `1`
    -   **Note**: This costs 5 API credits per call. Use sparingly.
    -   **Default**: `0`

## Example Request (GET)

To get an accurate availability check for `example.com` in JSON format:

```
https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=YOUR_API_KEY&domainName=example.com&outputFormat=JSON&da=2
```

## Response Data

When requesting JSON, the response contains a `WhoisRecord` object. Key fields to look for include:

-   `WhoisRecord.domainName`: The domain that was queried.
-   `WhoisRecord.domainAvailability`: `AVAILABLE` or `UNAVAILABLE`.
-   `WhoisRecord.registryData.createdDate`: Registration date (ISO 8601 format).
-   `WhoisRecord.registryData.expiresDate`: Expiration date (ISO 8601 format).
-   `WhoisRecord.registrarName`: The name of the registrar (e.g., "GoDaddy.com, LLC").
-   `ErrorMessage`: If an error occurs (e.g., invalid domain), this object will be present.
