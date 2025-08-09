# WhoAPI.com WHOIS Service Documentation

This document summarizes the key details for integrating the WhoAPI.com WHOIS service.

## Overview

The service provides parsed WHOIS registration data for domain names programmatically.

-   **Endpoint**: `http://api.whoapi.com/`
-   **Method**: `GET`
-   **Response Format**: `JSON` (default) or `XML`.

## Authentication

Authentication is required for every request and is handled via a query parameter.

-   **Parameter Name**: `apikey`
-   **Usage**: All requests must include `apikey=YOUR_API_KEY` in the URL's query string.

## Key Request Parameters

### Required

-   `apikey` (string): Your personal API key from the WhoAPI dashboard.
-   `r` (string): Must be set to the value `whois` for a parsed WHOIS lookup.
-   `domain` (string): The domain name you want to query.

## Example Request (GET)

To get parsed WHOIS data for `example.com` in JSON format:

```
http://api.whoapi.com/?domain=example.com&r=whois&apikey=YOUR_API_KEY
```

## Response Data

A successful response (`status: "0"`) returns a JSON object. Key fields to look for include:

-   `status`: A string code. `"0"` indicates success.
-   `registered`: A boolean (`true` or `false`) indicating if the domain is registered.
-   `date_created`: Registration date (e.g., "2011-02-14 15:31:26").
-   `date_expires`: Expiration date (e.g., "2021-02-14 15:31:26").
-   `whois_name`: The name of the registrar (e.g., "PublicDomainRegistry").
-   `contacts`: An array of contact objects. The registrar's full name can often be found in the contact object where `type` is `"registrar"`.
-   `requests_available`: Your remaining API request quota.

## Error Handling

If a request fails, the `status` field will contain a non-zero value, and `status_desc` will provide a human-readable error message.
