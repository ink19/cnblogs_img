import * as vscode from 'vscode';
import * as fs from 'fs';
import * as superagent from 'superagent';
import * as path from 'path';
import * as clipboardy from 'clipboardy';
import { checkout } from 'superagent';

let cnblogs_cookie_apsnetcore:string = "";
let cnblogs_cookie_CNBlogsCookie:string = "";

function get_cookie() {
	let configure = vscode.workspace.getConfiguration();
	cnblogs_cookie_apsnetcore = configure["cnblogs"]["cookie"]['AspNetCore'];
	cnblogs_cookie_CNBlogsCookie = configure["cnblogs"]["cookie"]['CNBlogsSession'];
}

async function upload_img(image_path : string) {
	// return "https://img2020.cnblogs.com/blog/2262855/202012/2262855-20201226163346313-580252528.jpg";
	console.log("Uploading~ " + image_path);
	let upload_url = "https://upload.cnblogs.com/imageuploader/processupload?host=www.cnblogs.com&qqfile=";
	//let upload_url = "http://127.0.0.1:8080/";
	console.log("begin upload");
	let return_data : superagent.Response = await superagent.post(upload_url + path.basename(image_path))
	.set("Cookie", ".Cnblogs.AspNetCore.Cookies=" + cnblogs_cookie_apsnetcore +";")
	.type('form')
	.accept('application/json')
	.attach("qqfile", image_path);
	let data = JSON.parse(JSON.parse(return_data.text));
	console.log(data);
	if (data["success"] == false) {
		console.log("上传失败～");
		vscode.window.showErrorMessage("Upload Error: " + data["message"]);
		return "";
	} else {
		console.log("上传成功～" + data.message);
		return <string>data.message;
	}
}

async function upload_single_img(image_path: string, work_space: string, cache : any) {
	let file_relative_path = "";
	let file_absolute_path = "";
	if (path.isAbsolute(image_path)) {
		file_relative_path = path.relative(work_space, image_path);
		file_absolute_path = image_path;
	} else {
		file_relative_path = image_path;
		file_absolute_path = path.resolve(work_space, image_path);
	}
	file_relative_path = path.normalize(file_relative_path);
	console.log("绝对路径～ " + file_absolute_path);
	console.log("相对路径～ " + file_relative_path);
	
	let file_stat = fs.statSync(file_absolute_path)
	if (cache.hasOwnProperty(file_relative_path) && file_stat.mtimeMs <= (<number>cache[file_relative_path]["upload_time"])) {
		console.log("cache命中～ " + cache[file_relative_path]["url"])
		return (cache[file_relative_path]["url"]);
	} else {
		console.log("开始上传～");
		let image_uri = await upload_img(file_absolute_path);
		cache[file_relative_path] = {
			url : image_uri,
			upload_time: Date.now()
		};
		return image_uri;
	}
}

async function upload_many_img(images_path : string[], work_space : string) {
	let cache_path = work_space + "/cnblog_img.json";
	let cache_obj = {}
	if (fs.existsSync(cache_path)) {
		cache_obj = JSON.parse(fs.readFileSync(cache_path).toString())
	} 

	console.log("读取到缓存文件～ ");
	console.log(cache_obj);

	let image_uri = await Promise.all(images_path.map(async (value) => {
		console.log("正在上传文件~ " + value);
		return await upload_single_img(value, work_space, cache_obj);
	}));
	console.log(cache_obj);
	fs.writeFileSync(cache_path, JSON.stringify(cache_obj));
	return image_uri;
}

function get_work_space(ipath : string) {
	let vsc_workspace = vscode.workspace.workspaceFolders;
	if (vsc_workspace == undefined || vsc_workspace.length == 0) {
		return path.dirname(ipath);
	} else {
		return vsc_workspace[0].uri.path;
	}
}

function test_login() {
	let test_url = "https://upload.cnblogs.com/imageuploader/upload?host=www.cnblogs.com&editor=4#md-editor";
	console.log(cnblogs_cookie_apsnetcore)
	superagent.get(test_url).set("Cookie", ".Cnblogs.AspNetCore.Cookies=" + cnblogs_cookie_apsnetcore +";") .then((respone : superagent.Response) => {
		console.log(respone)
		if ((<string>respone.text).indexOf("未登录，请先") != -1) {
			vscode.window.showErrorMessage("cnblogs的Cookie失效了～");
		} else {
			vscode.window.showInformationMessage("cnblogs已登陆~");
		}
	})
}

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "cnblog-img" is now active!');

	let disposable = vscode.commands.registerCommand('cnblog-img.login_test', () => {
		get_cookie();
		test_login();
	});

	let upload_from_context = vscode.commands.registerCommand('cnblog-img.upload-from-context', async (fileUri:vscode.Uri) => {
		console.log("upload-from-context");
		if (!fileUri) {
			vscode.window.showErrorMessage("Can't find the file");
			return;
		}
		get_cookie();
		

		let work_space = get_work_space(fileUri.path);
		console.log("获取到工作目录啦～ " + work_space);
		let image_uri = await upload_many_img([fileUri.path], work_space);
		console.log("已经上传文件啦～");
		clipboardy.writeSync(await image_uri[0]);
		vscode.window.showInformationMessage("已将URL复制到剪切板～");
		// console.log(vscode.workspace.workspaceFolders)
		//upload_img(fileUri.path);
	});

	let test_commend = vscode.commands.registerCommand('cnblog-img.just-for-test', () => {
		console.log(vscode.workspace.workspaceFolders);
	})

	// 自动删除
	context.subscriptions.push(disposable);
	context.subscriptions.push(upload_from_context);
	context.subscriptions.push(test_commend);
}

export function deactivate() {}

