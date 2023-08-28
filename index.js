const net = require('net');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const config = require('./config.json');
const { get } = require('http');


// BLOCKCHAIN CLASSES
class Block {
	constructor(index, transactions,  timestamp, previousHash, nonce = 0, data = [{}]) {
		this.index = index;
		this.transactions = transactions;
		this.data = data;
		this.timestamp = timestamp;
		this.previousHash = previousHash;
		this.nonce = nonce;
	}

	computeHash() {
		const blockString = JSON.stringify(this, Object.keys(this).sort());
		return crypto.createHash('sha256').update(blockString).digest('hex');
	}

	toJSON() {
		return {
			index: this.index,
			transactions: this.transactions,
			timestamp: this.timestamp,
			previousHash: this.previousHash,
			nonce: this.nonce,
			data: this.data
		};
	}

	static fromJSON(json) {
		const { index, transactions, timestamp, previousHash, nonce, data } = json;
		return new Block(index, transactions, timestamp, previousHash, nonce, data);
	}
}
class Blockchain {
	constructor() {
		this.initialized = false;
	}

	async initialize(startup) {
		const chainData = getChain();
		if (startup || Array.isArray(chainData) && chainData.length === 0) {
      		//If something is wrong with the chain or we reboot, get it form a peer
			this.chain = await requestBlockchainFromPeer(await getRandomPeer());
		} else {this.chain = chainData;}

		this.difficulty = 2;
		console.log("Blockchain initialized");
		this.initialized = true;
	}

	static async create(startup = false) {
		const o = new Blockchain();
		await o.initialize(startup);
		return o;
	}

	writeChain(data){
		fs.writeFileSync(config.blockchainFile, JSON.stringify(data));
	}

	getLatestBlock() {
		const latestBlockData = this.chain[this.chain.length - 1];
		return new Block(
			latestBlockData.index,
			latestBlockData.transactions,
			latestBlockData.timestamp,
			latestBlockData.previousHash,
			latestBlockData.nonce,
			latestBlockData.data
		);
	}
  
	getLatestBlockData() {
		return this.chain[this.chain.length - 1];
	}

	async addBlock(newBlock, proof, miner = null, mined = true) {
		const previousHash = this.getLatestBlock().computeHash();
		console.log("Checking block validity...");
		console.log("Hash by this node: ", previousHash);
		console.log("Hash according to the miner: ", newBlock.previousHash);
		//Check if the block is valid
		if (previousHash !== newBlock.previousHash) {//Check if the previous hash is correct
			console.log("Not valid hash");
			return false;
		}
		else if (!this.isValidProof(newBlock, proof)) {//Check if the proof is correct
			console.log("Not valid proof");
			return false;
		}//Check if the main transaction is tampered using TSK (Transaction Signature Key)
		else if(await validateTSK(newBlock.transactions[0].tsk, newBlock.transactions[0].fromAddress, newBlock.transactions[0].toAddress, newBlock.transactions[0].amount)){
			console.log("Block is tampered");
			return false;
		}//Check if someone is trying to steal gas
		else if (newBlock.transactions[1].amount !=  (newBlock.transactions[0].amount * 0.15) / 2){
			console.log("Node is trying to steal gas");
			return false;
		}
		else if (newBlock.transactions[2].amount !=  (newBlock.transactions[0].amount * 0.15) / 2){
			console.log("Miner is trying to steal gas");
			return false;
		}//The max number of transactions per block is 3
		else if (newBlock.transactions.length > 3){
			console.log("Too many transactions");
			return false;
		}
    
		this.chain.push(newBlock);
		console.log("Valid block from peer! Adding to chain...");

		this.writeChain(this.chain);
		if (mined){//Only spread the block if it is from miner
			console.log("Valid block from miner! Broadcasting to other peers...", {newBlock:newBlock.toJSON(), proof:proof});
    		broadcastData("spreadBlock", {newBlock:newBlock.toJSON(), proof:proof});
		}

		return true;
	}

	isValidProof(block, blockHash) {
		return blockHash.startsWith('0'.repeat(this.difficulty)) && blockHash === block.computeHash();
	}

	proofOfWork(block) {
		block.nonce = 0;
		let computedHash = block.computeHash();
		while (!computedHash.startsWith('0'.repeat(this.difficulty))) {
			block.nonce++;
			computedHash = block.computeHash();
		}
		return computedHash;
	}
	//Check the received transaction and broadcast to other peers and miners
	async addTransaction(transaction, data = [{}]) {
		console.log("Checking transaction validity...");

		const { fromAddress, toAddress, amount, tks } = transaction;
		if (await this.getBalance(fromAddress) < amount + amount * 0.15) {
			return { status: false, message: 'Insufficient balance or gas' };
		}else if (amount <= 0) {
			return { status: false, message: 'Insufficient amount' };
		}else if (toAddress <= "" || toAddress == fromAddress || toAddress == config.runnerUser) {
			return { status: false, message: 'Self spending' };
		}
		console.log("Valid transaction from wallet! Adding to unconfirmed pool...");
		saveTransaction([this.chain.length + 1, [transaction], Date.now(), data, config.runnerUser]);

		return { status: true, message: 'Transaction added successfully' };
	}

	async getBalance(address) {
		let balance = 0;
		for (const block of this.chain) {
			for (const transaction of block.transactions) {
				if (transaction.fromAddress === address) {
					balance -= transaction.amount;
				} else if (transaction.toAddress === address) {
					balance += transaction.amount;
				}
			}
		}
		return balance;
	}
  async getBlockchain() {
    console.log(this.chain);
    return this.chain.map(block => ({ ...block, transactions: [...block.transactions] }));
  }
}



let blockchain = [];

const peers = [
    { host: 'localhost', port: 3001 }
];
(async function() {
	try {
		const Coin = await Blockchain.create(true);
	} catch (err) {
		console.log("Cannot connect to peers: ", err.message);
	}
})();

// PEER DISCOVERY FUNCTIONS
async function getRandomPeer() {
    let res = await axios.get("https://raw.githubusercontent.com/coderscoin/nodexplorer/main/peers.json");
    let peers = res.data;
	const filteredData = peers.filter(entry => entry.user !== config.runnerUser);
	
    const randomIndex = Math.floor(Math.random() * filteredData.length);
    console.log("\x1b[93m Getting the list of nodes... \x1b[0m");
    return filteredData[randomIndex];
}

async function getPeers() {
	let res = await axios.get("https://raw.githubusercontent.com/coderscoin/nodexplorer/main/peers.json");
	let peers = res.data;
	const filteredData = peers.filter(entry => entry.user !== config.runnerUser);
	return filteredData;
}

// CHAIN FUNCTIONS
function getChain() {
    let blockchain = fs.readFileSync(config.blockchainFile);
    return JSON.parse(blockchain);
}

// EXTERNAL VALIDATION FUNCTIONS
async function validateTSK(tsk, sender, receiver, amount) {
	let data = {
		"tsk":tsk,
		"sender":sender,
		"receiver":receiver,
		"amount":amount
	};
	const res = await axios.post('https://cscvalidation.tillpetya20.repl.co/check', 
	data,
	  {
		headers: {
		  // Overwrite Axios's automatically set Content-Type
		  'Content-Type': 'application/json'
		}
	  });
	if (res.status == 200){
		return false;
	}else{
		return true;
	}
}

//TRANSACTION POOL FUNCTIONS
//Save unconfirmed transactions to local pool
function saveTransaction(data){
	let transactions = fs.readFileSync(config.transactionPoolFile);
  	let transaction = JSON.parse(transactions);
  	transaction.push(data);
  	fs.writeFileSync(config.transactionPoolFile, JSON.stringify(transaction));
}
//Load unconfirmed transactions from local pool
function loadTransaction(){
  	let transactions = fs.readFileSync(config.transactionPoolFile);
  	return JSON.parse(transactions)[0];
}
//Delete first unconfirmed transaction from local pool
function shiftTransaction(){
	let transactions = fs.readFileSync(config.transactionPoolFile);
  	let transaction = JSON.parse(transactions);
  	transaction.shift();
  	fs.writeFileSync(config.transactionPoolFile, JSON.stringify(transaction));
}

//LISTENING SERVER
const server = net.createServer(socket => {
	console.log('Node connected:', socket.remoteAddress + ':' + socket.remotePort);

	//Listen for data
	socket.on('data', async data => {
    	const receivedData = await JSON.parse(data);

		//Peer requests
		if (receivedData.type === 'requestBlockchain') {
			console.log('Received blockchain request from an other peer');
			const responseData = { type: 'sendBlockchain', blockchain:getChain() };
			socket.write(JSON.stringify(responseData));
		}else if(receivedData.type === 'spreadBlock'){
			console.log("Received new block from peer");
			const newBlock = receivedData.data.newBlock;
			const proof = receivedData.data.proof;
			const miner = receivedData.data.miner;

			const block = Block.fromJSON(newBlock);
			
			const Coin = await Blockchain.create(false);

			await Coin.addBlock(block, proof, miner, false);
		}//Miner requests
		else if (receivedData.type === 'mineRequest'){
			console.log("Received mine request from miner");
			const Coin = await Blockchain.create(false);
			let latestJSON = await Coin.getLatestBlock();
			const responseData = { type: 'mineResponse', transaction:loadTransaction(), latestBlock: latestJSON};
			shiftTransaction();
			socket.write(JSON.stringify(responseData));
		}
		else if (receivedData.type === 'newBlock'){
			console.log("Got this shit: ",receivedData.blocks.newBlock);
			let latestBlock = receivedData.blocks.latestblock;
			let newBlock = receivedData.blocks.newblock;
			let proof = receivedData.blocks.proof;
			let miner = receivedData.blocks.miner;
			console.log(receivedData);
			let block = Block.fromJSON(newBlock);
			const Coin = await Blockchain.create(false);
			console.log("Received new block from miner: ", Block.fromJSON(newBlock));
			console.log("Node:", Coin.proofOfWork(block));
			console.log("Miner:", proof);

			let check = await Coin.addBlock(block, proof, miner);
		}//Wallet requests
		else if (receivedData.type === 'newTransaction'){
			let transaction = receivedData.transaction;
			let data = receivedData.data;
			const Coin = await Blockchain.create(false);
			console.log("Transaction and data received from wallet: ", transaction, data);
			let check = await Coin.addTransaction({fromAddress: transaction.from, toAddress: transaction.to, amount: transaction.amount, tsk: transaction.tsk}, data);
			//ToDo: Add callback to wallet
		}
		else if (receivedData.type === 'getBalance'){
			console.log("Received balance request from wallet: ", receivedData.data);
			const Coin = await Blockchain.create(false);
			let balance = await Coin.getBalance(receivedData.data);//Holds an address
			socket.write(JSON.stringify({type: 'dataResponse', data: balance}));
		}
	});

	socket.on('error', error => {
		console.error('Socket error:', error);
	});

	socket.on('end', () => {
		console.log('Node disconnected:', socket.remoteAddress + ':' + socket.remotePort);
	});
});
//REQUESTS
async function requestBlockchainFromPeer(peer) {
  	console.log("Requesting blockchain from peer");
	const client = net.connect(peer.port, peer.host, () => {
		console.log('Connected to peer:', peer.host + ':' + peer.port);
		const requestData = { type: 'requestBlockchain' };
		client.write(JSON.stringify(requestData));
	});
    client.on('data', data => {
        const receivedData = JSON.parse(data.toString());
        if (receivedData.type === 'sendBlockchain') {
        fs.writeFileSync(config.blockchainFile, JSON.stringify(receivedData.blockchain));
          console.log('Received blockchain from peer:', receivedData.blockchain);
          // Handle received blockchain, e.g., replace current blockchain with received one
          blockchain = receivedData.blockchain;
		  //return blockchain;
		  stored = getChain();
		  if (blockchain.length > stored.length){
			console.log("Overwriting local chain...");
			return blockchain;
		  }
		  
		  console.log("Using local chain...");
          return stored;
        }
        client.end();
      });
	  client.on('error', error => {
		console.error(`Error connecting to ${peer.host}:${peer.port}: ${error.message}`);
		// Implement retry logic, e.g., using setTimeout
		setTimeout(() => requestBlockchainFromPeer(getRandomPeer()), 5000); // Retry after 5 seconds
	  });
	
}

function broadcastData(type, data) {
	peers.forEach(peer => {
		const client = net.connect(peer.port, peer.host, () => {
			console.log('Connected to peer:', peer.host + ':' + peer.port);
			client.write(JSON.stringify({type:type, data:data}));//JSON.stringify(data));
			//client.end();
		});
		client.on('error', err => {
			console.log(`Error connecting to ${peer.host}:${peer.port}: ${err.message}`);
			// Implement retry logic here
		});
    });
}


const PORT = config.serverPort;
server.listen(PORT, () => {
	console.log(`Node is running on port ${PORT}`);
});