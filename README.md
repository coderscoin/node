# <img src="https://coderscoin.github.io/assets/brand/icon.png" data-canonical-src="https://coderscoin.github.io/assets/brand/icon.png" width="35" height="35" /> CodersCoin Node
This is the official node software for CSC cryptocurrency. CodersCoin currently operates centrally, but the project will soon reach the decentralized phase.

[![Available](https://img.shields.io/badge/Available-PTP%20Testnet-red)](https://choosealicense.com/licenses/mit/)
[![Release](https://img.shields.io/badge/Release-Script-red)](https://opensource.org/licenses/)
## Important!
Unlike a miner, nodes must run 24 hours a day. Since the network is hardly used at the moment, 100% uptime is not required. You will have to apply if you want to run a node!
## Screenshots

![App Screenshot](https://via.placeholder.com/468x300?text=App+Screenshot+Here)
## Features

- Peer-to-peer decentralized protocol
- 
## Roadmap

- [x] Peer-to-peer network prototype
- [ ] Block validation function
- [ ] Node runner rewards
- [ ] Integration into testnet
- [ ] Node consensus algorithm implementation
## FAQ

#### Question 1

Answer 1

#### Question 2

Answer 2
## Mining API reference

### Get the latest block

```https
  GET /api/get/latestblock
```
This returns the latest block on the chain in JSON format.
#### Example Response
```json
{"index":12,"transactions":[{"fromAddress":"user1","toAddress":"user2","amount":10}],"timestamp":1688201520,"previousHash":"00329e3f7babcfc4dece5d7e2052b7eadf901b208e305d31f971145a85a5fe2c","nonce":270}
```
### Submit mined block

```https
  POST /mine/
```
#### Request
| Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `latesthash` | `string` | **Required**. The computed hash of the latest block |
| `proof` | `string` | **Required**. The proof returned from the PoW algorithm |
| `newblock` | `list` | **Required**. The newly mined block's details |
| `miner` | `string` | **Required**. The username of the miner |

#### Response
| Code | Description                       |
| :-------- | :-------------------------------- |
| `200` | The mining is successful and has been accepted by the network. |
| `403` | The user was banned from the platform due to fraud detected or the last block was not validated |
| `500` | Mining failed, the network rejected the request because it is incorrect. |

## Run Locally

Clone the project

```bash
  git clone https://link-to-project
```

Go to the project directory

```bash
  cd my-project
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  npm run start
```
## Contributing

Contributions are always welcome!

See `contributing.md` for ways to get started.

Please adhere to this project's `code of conduct`.
## Support

For support, email fake@fake.com or join our Slack channel.
## Authors

- [@petertill](https://www.github.com/petertill)

## License

[MIT](https://choosealicense.com/licenses/mit/)
