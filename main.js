const Web3 = require('web3')
const CSVToJson = require('csvtojson')
const Winston = require('winston')
const fs = require('fs');
const cli = require('cac')()

const ERC20Interface = require('./erc20-abi.json')
const batchTransferJsonInterface = require('./bt-abi.json')
const settings = require('./settings.json');

async function withdraw(dryRun, approve) {
    const now = new Date()

    const web3 = new Web3(settings.rpc)

    const logger = Winston.createLogger({
        transports: [
            new Winston.transports.Console(),
            new Winston.transports.File({
                filename: `log/${now}.log`
            }),
        ],
    })

    const op = settings.operationAccount
    const tokenOwner = settings.tokenOwner
    // Note that if the erc20 decimal is too large, js calculation might not able to be the accurate number
    // this package don't handle that and only recommend to use on low decimal erc20 like USDC to get the accurate transfer amount
    const erc20 = settings.ERC20Contract
    const bt = settings.batchTransferContract

    web3.eth.accounts.wallet.add(settings.operationAccountPK)
    const erc20Contract = new web3.eth.Contract(ERC20Interface, erc20)
    const batchTransferContract = new web3.eth.Contract(batchTransferJsonInterface, bt)

    const csvFilePath = 'data.csv'

    logger.info(`Copying data.csv to log/${now}.csv`);
    fs.copyFile('data.csv', `log/${now}.csv`, (err) => {
        if (err) throw err;
    });

    const dataJson = await CSVToJson().fromFile(csvFilePath)

    const accounts = []
    const amounts = []
    let sumAmount = 0

    dataJson.forEach(data => {
        accounts.push(data.address)
        let amountMulDec = Math.round(data.amount * settings.ERC20Decimal)
        amounts.push(amountMulDec.toLocaleString('fullwide', {
            useGrouping: false
        }))
        sumAmount += amountMulDec
    });

    const sumAmountString = sumAmount.toLocaleString('fullwide', {
        useGrouping: false
    })
    logger.info("Sum amount: " + sumAmountString)

    if (!dryRun) {
        if (approve) {
            // approve amount
            logger.info("Approving ERC20 token transfer from batch transfer contract...")
            const approveGas = await erc20Contract.methods.approve(bt, sumAmountString)
                .estimateGas({
                    from: op
                })
            let a = new Promise((resolve, reject) => {
                erc20Contract.methods.approve(bt, sumAmountString).send({
                        from: op,
                        gas: approveGas
                    })
                    .on('confirmation', function (confirmationNumber, receipt) {
                        if (confirmationNumber < 1) {
                            logger.info("TxID: " + receipt.transactionHash + " Confirmation: " + confirmationNumber)
                        } else {
                            logger.info("Tx confirmed")
                            resolve()
                        }
                    })
                    .on('error', function (error) {
                        reject(error)
                    })
            })

            await a
        }

        // transfer amount
        logger.info("Calling batch transfer function...")
        const batchTransferGas = await batchTransferContract.methods.batchTransferFrom(tokenOwner, accounts, amounts)
            .estimateGas({
                from: op
            })

        await batchTransferContract.methods.batchTransferFrom(tokenOwner, accounts, amounts).send({
                from: op,
                gas: batchTransferGas
            })
            .on('confirmation', function (confirmationNumber, receipt) {
                if (confirmationNumber < 1) {
                    logger.info("TxID: " + receipt.transactionHash + " Confirmation: " + confirmationNumber)
                } else {
                    logger.info("Tx confirmed")
                    logger.info("Process done")
                    process.exit(0)
                }
            })
    }
}

async function main() {
    cli
        .command('withdraw', 'withdraw')
        .option('--dry', 'dry run')
        .option('--approve', 'submit approve tx')
        .action(async (options) => {
            await withdraw(options.dry, options.approve)
        })
    cli.help()
    cli.parse()
}

main()
