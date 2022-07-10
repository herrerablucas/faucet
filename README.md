# faucet
**faucet** is a work in progress tool to automate the detection of cross-site leaks [(xsleaks)](https://xsleaks.dev/) vulnerabilities. The `--target` flag can be used to specify the entry point to start crawling from. The flag `--identifiers` is used to mark URLs containing path parameters and/or query strings where PII leakage is more likely.
### Supported attacks:
> - Frame counting
> - Error events
> - Navigations

