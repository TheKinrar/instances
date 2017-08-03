## Authentication

API requests need to be authenticated. [Get a token](/api/token) then use it in your requests:  
Set the *Authorization* header to "Bearer YOUR_TOKEN".  
For example, if your token is *aaa*, your *Authorization* header will be "Bearer aaa".

## Limits

There are no rate limits.  
However, you **need** to set a valid email address when you get your API token.
In case of abuse or "bad usage" of the API, your token will be deleted without
warning and your IP address may get banned.