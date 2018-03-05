import React, { Component } from "react";
import { connect } from "react-redux";
import { Link } from "react-router";
import { doSendAsset, verifyAddress } from "neon-js";
import Modal from "react-bootstrap-modal";
import axios from "axios";
import SplitPane from "react-split-pane";
import ReactTooltip from "react-tooltip";
import { log } from "../util/Logs";
import litecoinLogo from "../img/litecoin.png";
import Assets from "./Assets";
import { clipboard } from "electron";
import { togglePane } from "../modules/dashboard";
import {
	sendEvent,
	clearTransactionEvent,
	toggleAsset
} from "../modules/transactions";
import {BLOCK_TOKEN} from "../core/constants";

import { btcLoginRedirect } from '../modules/account';

var bitcoin = require("bitcoinjs-lib");
var WAValidator = require("wallet-address-validator");
var bigi = require("bigi");
var buffer = require("buffer");
var bcypher = require("blockcypher");
var CoinKey = require('coinkey')
let sendAddress, sendAmount, confirmButton;

const apiURL = val => {
	return "https://min-api.cryptocompare.com/data/price?fsym=LTC&tsyms=USD";
};

// form validators for input fields
const validateForm = (dispatch, neo_balance, gas_balance, asset) => {
	// check for valid address
	try {
		if (
			verifyAddress(sendAddress.value) !== true ||
      sendAddress.value.charAt(0) !== "A"
		) {
			dispatch(sendEvent(false, "The address you entered was not valid."));
			setTimeout(() => dispatch(clearTransactionEvent()), 1000);
			return false;
		}
	} catch (e) {
		dispatch(sendEvent(false, "The address you entered was not valid."));
		setTimeout(() => dispatch(clearTransactionEvent()), 1000);
		return false;
	}
	// check for fractional neo
	if (
		asset === "Neo" &&
    parseFloat(sendAmount.value) !== parseInt(sendAmount.value)
	) {
		dispatch(sendEvent(false, "You cannot send fractional amounts of Neo."));
		setTimeout(() => dispatch(clearTransactionEvent()), 1000);
		return false;
	} else if (asset === "Neo" && parseInt(sendAmount.value) > neo_balance) {
		// check for value greater than account balance
		dispatch(sendEvent(false, "You do not have enough NEO to send."));
		setTimeout(() => dispatch(clearTransactionEvent()), 1000);
		return false;
	} else if (asset === "Gas" && parseFloat(sendAmount.value) > gas_balance) {
		dispatch(sendEvent(false, "You do not have enough GAS to send."));
		setTimeout(() => dispatch(clearTransactionEvent()), 1000);
		return false;
	} else if (parseFloat(sendAmount.value) < 0) {
		// check for negative asset
		dispatch(sendEvent(false, "You cannot send negative amounts of an asset."));
		setTimeout(() => dispatch(clearTransactionEvent()), 1000);
		return false;
	}
	return true;
};

// open confirm pane and validate fields
const openAndValidate = (dispatch, neo_balance, gas_balance, asset) => {
	if (validateForm(dispatch, neo_balance, gas_balance, asset) === true) {
		dispatch(togglePane("confirmPane"));
	}
};

// perform send transaction
const sendTransaction = (
	dispatch,
	net,
	selfAddress,
	wif,
	asset,
	neo_balance,
	gas_balance,
	ltc_balance
) => {
	// validate fields again for good measure (might have changed?)
	if (validateForm(dispatch, neo_balance, gas_balance, asset) === true) {
		dispatch(sendEvent(true, "Processing..."));

		log(net, "SEND", selfAddress, {
			to: sendAddress.value,
			asset: asset,
			amount: sendAmount.value
		});
        console.log("Display ltc balance\n");
        console.log(ltc_balance);
		//Send litecoin
        let send_amount = parseFloat(sendAmount.value);

        if (ltc_balance <= 0) {
            dispatch(sendEvent(false, "There is not balance for LTC."));
		} else if (ltc_balance < sendAmount.value) {
            dispatch(sendEvent(false, "The LTC balance is less than the send amount."));
		} else {
            let new_base,send_base;
            let satoshi_amount = parseInt(send_amount * 100000000);
            console.log("wif ="+wif);
            var ck = CoinKey.fromWif(wif);
            var privateKey = ck.privateKey.toString('hex');
            console.log("hex private key = "+privateKey);
            var keys    = new bitcoin.ECPair(bigi.fromHex(privateKey));
            console.log("keys ="+keys);
            var newtx = {
                inputs: [{addresses: [selfAddress]}],
                outputs: [{addresses: [sendAddress.value], value: satoshi_amount}]
            };

            if(net === "MainNet") {
                new_base = "https://api.blockcypher.com/v1/ltc/main/txs/new?token=" + BLOCK_TOKEN;
                send_base = "https://api.blockcypher.com/v1/ltc/main/txs/send?token=" + BLOCK_TOKEN;
            } else {
                new_base = "https://api.blockcypher.com/v1/ltc/test3/txs/new?token="+BLOCK_TOKEN;
                send_base = "https://api.blockcypher.com/v1/ltc/test3/txs/send?token="+BLOCK_TOKEN;
            }

            axios.post(new_base,newtx)
                .then(function (tmptx) {
                    console.log("create new transaction= "+JSON.stringify(tmptx));
                    var sendtx = {
                        tx: tmptx.data.tx
                    }
                    sendtx.pubkeys = [];
                    sendtx.signatures = tmptx.data.tosign.map(function(tosign, n) {
                        sendtx.pubkeys.push(keys.getPublicKeyBuffer().toString("hex"));
                        return keys.sign(new buffer.Buffer(tosign, "hex")).toDER().toString("hex");

                    });

                    axios.post(send_base, sendtx).then(function(finaltx) {
                        console.log("finaltx= "+ finaltx);
                    })
                });
		}
	}
	// close confirm pane and clear fields
	dispatch(togglePane("confirmPane"));
	sendAddress.value = "";
	sendAmount.value = "";
	confirmButton.blur();
};

class SendLTC extends Component {
	constructor(props) {
		super(props);
		this.state = {
			open: true,
			gas: 0,
			neo: 0,
			neo_usd: 0,
			gas_usd: 0,
			value: 0,
			inputEnabled: true
		};
		this.handleChangeNeo = this.handleChangeNeo.bind(this);
		this.handleChangeGas = this.handleChangeGas.bind(this);
		this.handleChangeUSD = this.handleChangeUSD.bind(this);

		if(!this.props.btcLoggedIn){
			this.props.dispatch(btcLoginRedirect("/sendBTC"));
			this.props.history.push("/newBitcoin");
		}
	}

	async componentDidMount() {
		let neo = await axios.get(apiURL("NEO"));
		let gas = await axios.get(apiURL("GAS"));
		neo = neo.data.USD;
		gas = gas.data.USD;
		this.setState({ neo: neo, gas: gas });
	}

	handleChangeNeo(event) {
		this.setState({ value: event.target.value }, (sendAmount = value));
		const value = event.target.value * this.state.neo;
		this.setState({ neo_usd: value });
	}

	handleChangeGas(event) {
		this.setState({ value: event.target.value }, (sendAmount = value));
		const value = event.target.value * this.state.gas;
		this.setState({ gas_usd: value });
	}

	async handleChangeUSD(event) {
		this.setState({ gas_usd: event.target.value });

		let gas = await axios.get(apiURL("GAS"));
		gas = gas.data.USD;
		this.setState({ gas: gas });
		console.log("done");
		const value = this.state.gas_usd / this.state.gas;
		this.setState({ value: value }, (sendAmount = value));
	}

	render() {
		const {
			dispatch,
			wif,
			address,
			ltc_address,
			ltc_prvkey,
			status,
			neo,
			gas,
			ltc,
			net,
			confirmPane,
			selectedAsset,
		} = this.props;
		let confirmPaneClosed;
		let open = true;
		if (confirmPane) {
			confirmPaneClosed = "100%";
			open = true;
		} else {
			open = false;
			confirmPaneClosed = "69%";
		}

		let btnClass;
		let formClass;
		let priceUSD = 0;
		let gasEnabled = false;
		let inputEnabled = true;
		let convertFunction = this.handleChangeNeo;
		if (selectedAsset === "Neo") {
			btnClass = "btn-send";
			convertFunction = this.handleChangeNeo;
			formClass = "form-control-exchange";
			priceUSD = this.state.neo_usd;
			inputEnabled = true;
		} else if (selectedAsset === "Gas") {
			gasEnabled = true;
			inputEnabled = false;
			btnClass = "btn-send";
			formClass = "form-control-exchange";
			priceUSD = this.state.gas_usd;
			convertFunction = this.handleChangeGas;
		}
		return (
			<div>
				<Assets />
				<div id="send">

					<div className="row dash-chart-panel">
						<div className="col-xs-9">
							<img
								src={litecoinLogo}
								alt=""
								width="45"
								className="neo-logo fadeInDown"
							/>
							<h2>Send Litecoin (LTC)</h2>
						</div>

						<div className="col-xs-3 center">

						</div>

						<div className="col-xs-12 center">
							<hr className="dash-hr-wide top-20" />
						</div>

						<div className="clearboth" />

						<div className="top-20">
							<div className="col-xs-9">
								<input
									className={formClass}
									id="center"
									placeholder="Enter a valid BTC public address here"
									ref={node => {
										sendAddress = node;
									}}
								/>
							</div>

							<div className="col-xs-3">

							<Link to={ "/receiveLitecoin" }>
								<button className="grey-button com-soon" >
									<span className="glyphicon glyphicon-qrcode marg-right-5"/>  Receive
								</button></Link>

							</div>

							<div className="col-xs-5  top-20">
								<input
									className={formClass}
									type="number"
									id="assetAmount"
									min="1"
									onChange={convertFunction}
									value={this.state.value}
									placeholder="Enter amount to send"
									ref={node => {
										sendAmount = node;
									}}
								/>
								<div className="clearboth"/>
								<span className="com-soon block top-10">Amount in BTC to send</span>
							</div>
							<div className="col-xs-4 top-20">
								<input
									className={formClass}
									id="sendAmount"
									onChange={this.handleChangeUSD}
									onClick={this.handleChangeUSD}
									disabled={gasEnabled === false ? true : false}
									placeholder="Amount in US"
									value={`${priceUSD}`}
								/>
								<label className="amount-dollar">$</label>
								<div className="clearboth"/>
								<span className="com-soon block top-10">Calculated in USD</span>
							</div>
							<div className="col-xs-3 top-20">
								<div id="sendAddress">
									<button
										className="grey-button"
										onClick={() =>
											sendTransaction(
												dispatch,
												net,
												ltc_address,
												ltc_prvkey,
												selectedAsset,
												neo,
												gas,
												this.props.ltc
											)
										}
										ref={node => {
											confirmButton = node;
										}}
									>
										<span className="glyphicon glyphicon-send marg-right-5"/>  Send
									</button>
								</div>
							</div>

						</div>
					</div>

					<div className="send-notice">
						<p>
              Your LTC address can be used to receive Bitcoin ONLY. Sending funds other than Litecoin (LTC) to this address may result in your funds being lost.
						</p>
						<div className="col-xs-2 top-20"/>
						<div className="col-xs-8 top-20">
							<p className="center donations"
								data-tip
								data-for="donateTip"
								onClick={() => clipboard.writeText("LhN4Y7QiYpefjyGHp8Fz4Jn9UoRiEf5VQs")}
							>Morpheus Dev Team: LhN4Y7QiYpefjyGHp8Fz4Jn9UoRiEf5VQs</p>
							<ReactTooltip
								className="solidTip"
								id="donateTip"
								place="top"
								type="light"
								effect="solid"
							>
								<span>Copy address to send donation</span>
							</ReactTooltip>
						</div>
					</div>


				</div>







			</div>
		);
	}
}

const mapStateToProps = state => ({
	blockHeight: state.metadata.blockHeight,
	wif: state.account.wif,
	address: state.account.address,
	ltc_address:state.account.ltcPubAddr,
	ltc_prvkey:state.account.ltcPrivKey,
	net: state.metadata.network,
	neo: state.wallet.Neo,
	gas: state.wallet.Gas,
	ltc: state.wallet.Ltc,
	marketBTCPrice: state.wallet.marketBTCPrice,
	selectedAsset: state.transactions.selectedAsset,
	confirmPane: state.dashboard.confirmPane,
	btcLoggedIn: state.account.btcLoggedIn,
	btcPrivKey: state.account.btcPrivKey,
	btcPubAddr: state.account.btcPubAddr,
});

SendLTC = connect(mapStateToProps)(SendLTC);

export default SendLTC;
