let fs = require('fs')
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
const ROOT_DIR = path.resolve(argv.dir || process.cwd())
const tcpPort = 8099
let jot = require('json-over-tcp')

function connect(){
	let socket = jot.connect(tcpPort)
	console.log(`CONNECTING @ TCP Port: ${tcpPort}`)
	socket.on('connect', () =>{
		console.log("connect successful")
		socket.on('data', (data) => {
			async () => {
				console.log("From Server: " + data.action)
				let filePath = path.resolve(path.join(ROOT_DIR, data.path))
				console.log("filePath: " + filePath)
				// let fileStat = null
				// fs.promise.stat(filePath)
				// 	.then(stat => fileStat = stat, () => fileStat = null)
				// 	.catch()
				// let fileMtime = fileStat.mtime.getTime()
				// console.log("fileMtime: " + fileMtime)
				let fileIsDir = data.type === "dir" ? true : false
				console.log("fileIsDir: " + fileIsDir)
				let fileDirPath = fileIsDir ? filePath : path.dirname(filePath)
				console.log("fileDirPath: " + fileDirPath)
				console.log("Contents: " + data.contents)
				if (data.action === "create"){
					// if (fileStat) {
					// 	console.log("Can not create, the file exist")
					// 	return
					// }
					await mkdirp.promise(fileDirPath)
					if (!fileIsDir) fs.promise.writeFile(filePath, data.contents).then(console.log('File created'))
						// fs.createReadStream(data.contents).pipe(fs.createWriteStream(filePath))
				}
				else if (data.action === "update"){
					// if (!fileStat) {
					// 	console.log("Can not update, the file does not exist")
					// 	return
					// }
					if (fileIsDir) {
						console.log("Can not update, this is a directory")
						return
					}
					await fs.promise.truncate(filePath, 0)
					fs.promise.writeFile(filePath, data.contents).then(console.log('File Updated'))
				}
				else if (data.action === "delete"){
					// if (!fileStat) {
					// 	console.log("Can not delete, path not valid")
					// 	return
					// }
					if (fileIsDir){
						await rimraf.promise(filePath)
					} else await fs.promise.unlink(filePath).then(console.log('File Deleted'))
				}
				else {
					console.log("action is not supported: "+ data.action)
				}

			}()
		})
	})
	socket.on('timeout', () => {
		socket.destroy()
		connect()
	})
	socket.on('close', () => {
		socket.destroy()
		connect()
	})
	socket.on('error', () => {
		socket.destroy()
		connect()
	})
}
connect()


