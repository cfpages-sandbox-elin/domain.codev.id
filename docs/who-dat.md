# `who-dat` Free & Open Source WHOIS Service

This document summarizes the key details for integrating `who-dat`, a free and open-source WHOIS lookup service. It's an excellent primary WHOIS provider as it can be self-hosted for free.

## Overview

`who-dat` provides a simple, no-CORS, no-auth (by default) API for fetching WHOIS records.

-   **Public API Base URL**: `https://who-dat.as93.net`
-   **Self-Hosted URL**: Your own custom domain (e.g., from a Vercel deployment).

## Endpoints

-   **Single Domain Lookup**: `/[domain]`
    -   Example: `https://who-dat.as93.net/example.com`
-   **Multiple Domain Lookup**: `/multi`
-   **API Specification**: A full OpenAPI/Swagger spec is available at the root of the deployed instance for interactive testing.

## Authentication (Optional)

Authentication is optional and can be enabled by setting the `AUTH_KEY` environment variable in your hosting environment (e.g., Vercel).

-   If `AUTH_KEY` is set, requests must include it in the `Authorization` header.
-   **Supported Formats**:
    -   `Authorization: your-secret-key`
    -   `Authorization: Bearer your-secret-key`
-   If `AUTH_KEY` is not set, the API remains public.

## Deployment (Recommended)

Self-hosting is the recommended approach for stability and privacy.

-   **Option 1: Vercel (Easiest)**
    1.  Fork the [official repository](https://github.com/Lissy93/who-dat).
    2.  Import the forked repository into your Vercel account.
    3.  Vercel will automatically deploy it. No configuration is needed for a basic setup.
    4.  Use the **1-Click Deploy Button** on the GitHub page for an even faster setup.

-   **Option 2: Docker**
    -   A pre-built Docker image is available on DockerHub and GHCR.
    -   Run the container with: `docker run -p 8080:8080 lissy93/who-dat`

## Response Data

The API returns a JSON object with WHOIS information. Key fields include:

-   `domainName`: The queried domain.
-   `isAvailable`: A boolean indicating if the domain can be registered.
-   `dates`: An object containing...
    -   `created`: The registration date (ISO 8601 format).
    -   `expiry`: The expiration date (ISO 8601 format).
-   `registrar`: An object containing...
    -   `name`: The name of the registrar.
-   `error`: An error message if the lookup failed.
