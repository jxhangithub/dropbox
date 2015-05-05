let fs = require('fs')
let net = require('net')
let path = require('path')
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let argv = require('yargs')
   .argv
require('songbird')
// let moment = require('moment')

// HTTP server
const PORT = process.env.PORT || 8000
const ROOT_DIR = path.resolve(argv.dir || process.cwd())
let app = express()

// TCP server
const TCPPORT = 8099
let jot = require('json-over-tcp')
let tcpServer = jot.createServer(TCPPORT)
tcpServer.listen(TCPPORT)
console.log(`LISTENING @ TCP port: ${TCPPORT}`)
// tcpServer.on('connection', (socket) =>{
// 	socket.write({"action": "Hello, world?"})
// 	socket.on('data', (data) =>{
// 		console.log("Server Received: " + data.action)
// 	})
// })
let sockets = []
tcpServer.on('connection', (socket) => {
	sockets.push(socket)
	socket.on('close', ()=> {
		sockets.splice(sockets.indexOf(socket), 1)
	})
})

// const NODE_ENV = process.env.NODE_ENV
// if (NODE_ENV === 'development'){
// 	app.use(morgan('dev'))
// }
app.use(morgan('dev'))
app.listen(PORT, ()=> console.log(`LISTENING @ http://127.0.0.1:${PORT}`))

// console.log("Moment: " + moment().format('x'))

app.get('*', setFileMeta, sendHeaders, (req, res) => {
	// if directory
	if (res.body){
		res.json(res.body)
		return
	}
	// if file
	fs.createReadStream(req.filePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())


app.delete('*', setFileMeta, (req, res, next) => {
	async () => {
		if (!req.stat) return res.status(400).send('Invalid Path')

		if (req.stat.isDirectory()){
			await rimraf.promise(req.filePath)
		} else await fs.promise.unlink(req.filePath)
		res.end()
		// let fileStat = await fs.promise.stat(req.filePath)
		let fileMtime = req.stat.mtime.getTime()
		console.log("fileMtime: " + fileMtime)
		let fileType = req.stat.isDirectory() ? "dir" : "file"
		console.log("fileType: " + fileType)
		console.log("req.url: " + req.url)
		// sockets.forEach( (socket) => {
		for (let socket of sockets) {
			socket.promise.write({
				"action": "delete",
				"path": req.url,
				"type": fileType,
				"contents": null,
				"updated": fileMtime
			})
		}
	}().catch(next)
})


app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
	async () => {
		if (req.stat) return res.status(405).send('File Exists')
		await mkdirp.promise(req.dirPath)
		if (!req.isDir) req.pipe(fs.createWriteStream(req.filePath))
		res.end()
		// let fileString = null
		let fileStat = await fs.promise.stat(req.filePath)
		let fileMtime = fileStat.mtime.getTime()
		console.log("fileMtime: " + fileMtime)
		let fileContent = null
		if (!req.isDir) {
			fileContent = await fs.promise.readFile(req.filePath, "utf8")
			// fileString = JSON.stringify(fileContent)
			// console.log("fileString: " + fileString)
			console.log("fileContent: " + fileContent)
		}
		let fileType = req.isDir ? "dir" : "file"
		console.log("fileType: " + fileType)
		console.log("req.url: " + req.url)
		// sockets.forEach( (socket) => {
		for (let socket of sockets) {
			socket.promise.write({
				"action": "create",
				"path": req.url,
				"type": fileType,
				"contents": fileContent,
				"updated": fileMtime
			})
		}
	}().catch(next)
})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
	async () => {
		if (!req.stat) return res.status(405).send('File Does Not Exist')
		if (req.isDir) return res.status(405).send('Path is a directory')
		await fs.promise.truncate(req.filePath, 0)
		req.pipe(fs.createWriteStream(req.filePath))
		res.end()
		// let fileString = null
		let fileStat = await fs.promise.stat(req.filePath)
		let fileMtime = fileStat.mtime.getTime()
		console.log("fileMtime: " + fileMtime)
		let fileContent = null
		if (!req.isDir) {
			fileContent = await fs.promise.readFile(req.filePath, "utf8")
			// fileString = JSON.stringify(fileContent)
			// console.log("fileString: " + fileString)
			console.log("fileContent: " + fileContent)
		}
		let fileType = req.isDir ? "dir" : "file"
		console.log("fileType: " + fileType)
		console.log("req.url: " + req.url)
		// sockets.forEach( (socket) => {
		for (let socket of sockets) {
			socket.promise.write({
				"action": "update",
				"path": req.url,
				"type": fileType,
				"contents": fileContent,
				"updated": fileMtime
			})
		}
	}().catch(next)
})

function setDirDetails(req, res, next) {
	let endsWithSlash = req.filePath.charAt(req.filePath.length-1) === path.sep
	let hasExt = path.extname(req.filePath) !== ''
	req.isDir = endsWithSlash || !hasExt
	req.dirPath = req.isDir ? req.filePath : path.dirname(req.filePath)
	next()
}

function setFileMeta(req, res, next) {
	req.filePath = path.resolve(path.join(ROOT_DIR, req.url))
	if (req.filePath.indexOf(ROOT_DIR) !== 0){
		res.status(400).send('Invalid Path')
		return
	}
	fs.promise.stat(req.filePath)
      .then(stat => req.stat = stat, () => req.stat = null)
      .nodeify(next)
}
function sendHeaders(req, res, next){
	nodeify(async ()=> {
		if (req.stat.isDirectory()){
			let files = await fs.promise.readdir(req.filePath)
			res.body = JSON.stringify(files)
			res.setHeader('Content-Length', res.body.length)
			res.setHeader('Content-Type', 'application/json')
			return
		}
		res.setHeader('Content-Length', req.stat.size)
		let contentType = mime.contentType(path.extname(req.filePath))
		res.setHeader('Content-Type', contentType)
	}(), next)
}




















