# Specular Bridge UI 

## Local Deployment
- run a local specular testnet and wait for all contracts to be deployed
- if you are running specular with SPC
    - run `pnpm dev` to generate a default config and start the webapp
- else:
    - run `cp config/local .env` and fill in the L1 contract addresses
    - run `pnpm start`

## Testnet Deployment
- config for the current testnet is at `config/sepolia`
- run `cp config/sepolia .env`
- `pnpm build` to generate the `dist` directory

