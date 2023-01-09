# csv-erc20-batch-transfer
The batch transfer contract is a modified version of https://github.com/singnet/batch-token-transfer/blob/main/contracts/TokenBatchTransfer.sol

Which you could check here: https://goerli.etherscan.io/address/0xe79cebdb76913ef77eabbfb120d6fcc1f0ff7d8a#code

Note that if the erc20 decimal is too large, js calculation might not able to be the accurate number, this package did't handle that and only recommend to use on low decimal erc20 like USDC to get the accurate transfer amount

## Install
```shell
npm install
```
### Start
Add the `settings.json` first and modify the `data.csv`
```shell
npm start
```
