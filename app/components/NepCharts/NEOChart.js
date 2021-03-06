import React, { Component } from "react";
import { connect } from "react-redux";
import ReactTooltip from "react-tooltip";
import { Line } from "react-chartjs-2";
import axios from "axios";
import _ from "lodash";
import moment from "moment";
import { Link } from "react-router";

// CryptoCompare API for ChartJS
const api = val => {
	return `https://min-api.cryptocompare.com/data/histohour?fsym=${
		val
	}&tsym=USD&limit=24&aggregate=3&e=CCCAGG`;
};

class Charts extends Component {
	constructor(props) {
		super(props);
		this.state = {
			neoData: [],
			gasData: [],
			open: "--",
			high: "--",
			low: "--"
		};
	}

	async componentDidMount() {
		await this.getGasData();
		await this.getNeoData();
	}

	async getGasData() {
		try {
			let req = await axios.get(api("GAS"));
			let data = req.data.Data;
			this.setState({ gasData: data });
		} catch (error) {
			console.log(error);
		}
	}
	// NEO
	async getNeoData() {
		try {
			let req = await axios.get(api("NEO"));
			let data = req.data.Data;
			this.setState({ neoData: data });
		} catch (error) {
			console.log(error);
		}
	}
	// Chart Data
	render() {
		const neoPrices = _.map(this.state.neoData, "close");
		const neoHours = _.map(this.state.neoData, "time");
		const convertedTime = neoHours.map(val => moment.unix(val).format("LLL"));
		const gasPrices = _.map(this.state.gasData, "close");
		// Chart Styling
		const data = canvas => {
			let ctx = canvas.getContext("2d");
			let gradientStroke = ctx.createLinearGradient(500, 0, 100, 0);
			gradientStroke.addColorStop(0, "#7ED321");
			gradientStroke.addColorStop(1, "#7ED321");

			let gradientFill = ctx.createLinearGradient(0, 0, 0, 360);
			gradientFill.addColorStop(0, "rgba(68,147,33,0.8)");
			gradientFill.addColorStop(1, "rgba(68,147,33,0)");
			const gradient = ctx.createLinearGradient(0, 0, 100, 0);

			let gasGradientStroke = ctx.createLinearGradient(500, 0, 100, 0);
			gasGradientStroke.addColorStop(0, "#9013FE");
			gasGradientStroke.addColorStop(1, "#9013FE");

			let gasGradientFill = ctx.createLinearGradient(0, 0, 0, 360);
			gasGradientFill.addColorStop(0, "rgba(144,147,254, 1)");
			gasGradientFill.addColorStop(1, "rgba(144,147,254, 0)");

			// Chart Content
			return {
				labels: convertedTime,
				datasets: [
					{
						label: "GAS",
						fill: true,
						lineTension: 0.25,
						backgroundColor: gasGradientFill,
						borderColor: gasGradientStroke,
						borderCapStyle: "butt",
						borderDash: [],
						borderDashOffset: 0.0,
						borderJoinStyle: "miter",
						pointBorderWidth: 1,
						pointHoverRadius: 3,
						pointHoverBorderWidth: 0,
						pointBorderColor: gasGradientStroke,
						pointBackgroundColor: gasGradientStroke,
						pointHoverBackgroundColor: gasGradientStroke,
						pointHoverBorderColor: gasGradientStroke,
						pointHitRadius: 3,
						pointRadius: 0,
						data: gasPrices
					},
					{
						label: "NEO",
						fill: true,
						lineTension: 0.25,
						backgroundColor: gradientFill,
						borderColor: gradientStroke,
						borderCapStyle: "butt",
						borderDash: [],
						borderDashOffset: 0.0,
						borderJoinStyle: "miter",
						pointBorderWidth: 1,
						pointHoverRadius: 3,
						pointHoverBorderWidth: 0,
						pointBorderColor: gradientStroke,
						pointBackgroundColor: gradientStroke,
						pointHoverBackgroundColor: gradientStroke,
						pointHoverBorderColor: gradientStroke,
						pointHitRadius: 3,
						pointRadius: 0,
						data: neoPrices
					}
				]
			};
		};
		return (
			<div>
							<Line
								data={data}
								width={300}
								height={130}
								options={{
									responsive: true,
									scales: {
										xAxes: [
											{
												type: "time",
												position: "bottom",
												id: "x-axis-0",
												categoryPercentage: 1,
												barPercentage: 1,
												gridLines: { color: "rgba(255, 255, 255, 0.04)" },
												display: false
											}
										],
										yAxes: [
											{
												gridLines: { color: "rgba(255, 255, 255, 0.04)" }
											}
										]
									},
									legend: {
										position: "top",
										labels: {
											boxWidth: 15,
											padding: 20
										}
									}
								}}
							/>
			</div>
		);
	}
}

const mapStateToProps = state => ({
	neo: state.wallet.Neo,
	gas: state.wallet.Gas,
	address: state.account.address,
	net: state.metadata.network,
	price: state.wallet.price
});

Charts = connect(mapStateToProps)(Charts);

export default Charts;
