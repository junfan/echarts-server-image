/**
 * @file phantom
 * @author powerfj(powerfj@gmail.com)
 */
var phantom = require('phantom');
var path = require('path');
var util = require('util')

/***
 * 把需要生成的图表的option，宽度，高度，id ，组合成一个chart对象
 * 生成的时候会以output/echarts_<id>.png 保存生成的文件
 *
 * json文件中存储的是一个数组，我们就可以生成多个，比如
 *
 * [{
 *      id:'11',
 *      width:800,
 *      height:400,
 *      option:option
 * }]
 */

var userArgs = process.argv.slice(2);

var searchPattern = userArgs[0];

function printHelp(){
    console.log('%s %s <echart_json_file>',process.argv[0],process.argv[1])
}

if(userArgs.length<=0){
    printHelp();
}
else{
    main(userArgs[0])
}

function main(json_file){

    function get_chart_json_from_file(){
        return JSON.parse(require('fs').readFileSync(json_file,'utf-8'));
    }


    function get_chart_json(){
        if(!arguments.callee.__charts){
            arguments.callee.__charts = get_chart_json_from_file();
        }
        return arguments.callee.__charts || []
    }

    var done_count = 0;
    var need_count = get_chart_json().length;
    var phantomInstance = null;

    var url = 'file://' + path.resolve(__dirname, '../www/echarts_bak.html');
    var outfile_base = path.resolve(__dirname, '../output/echarts_%s.png');

    function writeImageToFile(id,data){
        data = data.replace(/^data:image\/png;base64,/, '');
        var dataBuffer = new Buffer(data, 'base64');
        var outfile = util.format(outfile_base,id)
        require('fs').writeFileSync(outfile, dataBuffer, 'base64');
        done_count ++;
        console.log('write file to '+outfile)
        if(need_count==done_count){
            phantomInstance.exit();
        }
    }


    var function_base = "function webPageRunFunc(){ var cJSON = '%s'; var c = JSON.parse(cJSON); var pngURL = createChart(c.width,c.height,c.option); return [c.id, pngURL]; }"

    phantom.create(function (ph) {
      phantomInstance = ph;
      ph.createPage(function (page) {
        page.open(url, function (status) {
            if (status !== 'success') {
                ph.exit();
                return;
            }
            var charts = get_chart_json();
            for(var i=0;i<charts.length;i++){
                var cdata = charts[i];
                //evaluate 这里调用的方法会在phantom的页面环境里面执行，所以访问不到当前的json环境
                //所以需要把它转化为方法然后过去执行
                var fnstr =  util.format(function_base,JSON.stringify(cdata))
                var fn = eval(fnstr);
                page.evaluate(webPageRunFunc, function (result) {
                    writeImageToFile(result[0],result[1])
                });
            }
        });
      });
    });
}
