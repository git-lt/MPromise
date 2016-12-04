依据标准自定的Promise工具类，便于学习理解Promise，也可尝试用于项目使用，百分百通过了 Promise/A+ 的标准测试。

如果你喜欢，烦请给个 `star` ,谢谢!

详细实现过程，请阅读我的分享 [深入理解 Promise (中)]()

## 扩展方法

### 静态方法
- all
- race 
- stop
- defer
- resolve
- reject

### 实例方法
- wait
- always
- done
- timeout
- sequence

## 扩展说明

### all

用于并行执行promise组成的数组（数组中可以不是Promise对象，在调用过程中会使用 `Promise.resolve(value)` 转换成Promise对象），如果全部成功则获得成功的结果组成的数组对象，如果失败，则获得失败的信息，返回一个新的Promise对象

```javascript
Promise.all = function(iterable){
 var _this = this;
 return new this(function(resolve, reject){
   if(!iterable || !Array.isArray(iterable)) return reject( new TypeError('must be an array') );
   var len = iterable.length;
   if(!len) return resolve([]);

   var res = Array(len), called=false;

   iterable.forEach(function(v, i){
     (function(i){
       _this.resolve(v).then(function(value){
         res[i]=value;
         if(++counter===len && !called){
           called = true;
           return resolve(res)
         }
       }, function(err){
         if(!called){
           called = true;
           return reject(err);
         }
       })
     })(i)
   })
 })
}
```

使用方式
```javascript
function fn1(){
    return new Promise(resolve => setTimeout(()=>resolve(1), 3000))
}
function fn2(){
    return new Promise(resolve => setTimeout(()=>resolve(2), 2000))
}
Promise.all([fn1(), fn2()]).then(res=>console.log(res), err=>console.log(err))
// [1, 2]
```

### race
用于并行执行promise组成的数组（数组中可以不是Promise对象，在调用过程中会使用 `Promise.resolve(value)` 转换成Promise对象），如果某个promise的状态率先改变，就获得改变的结果，返回一个新的Promise对象

```javascript
Promise.race = function(iterable){
  var _this = this;
  return new this(function(resolve, reject){
    if(!iterable || !Array.isArray(iterable)) return reject( new TypeError('must be an array') );
    var len = iterable.length;
    if(!len) return resolve([]);

    var called = false;
    iterable.forEach(function(v, i){
      _this.resolve(v).then(function(res){
        if(!called){
          called = true;
          return resolve(res);
        }
      }, function(err){
        if(!called){
          called = true;
          return reject(err);
        }
      })
    })
  })
}
```

使用方式

```javascript
function fn1(){
    return new Promise(resolve => setTimeout(()=>resolve(1), 3000))
}
function fn2(){
    return new Promise(resolve => setTimeout(()=>resolve(2), 2000))
}
Promise.race([fn1(), fn2()]).then(res=>console.log(res), err=>console.log(err))
// 2
```

### wait
用于一个promise任务结束后等待指定的时间再去执行一些操作

```javascript
Promise.prototype.wait = function(ms){
  var P = this.constructor;
  return this.then(function(v){
    return new P(function(resolve, reject){
      setTimeout(function(){ resolve(v); }, ~~ms)
    })
  }, function(r){
    return new P(function(resolve, reject){
      setTimeout(function(){ reject(r); }, ~~ms)
    })
  })
}
```
使用

```javascript
fn1().wait(2000).then(res=>console.log(res),err=>console.log(err))
```

这里考虑到，`wait` 是用于promise实例对象上的，那么为了可以保证链式调用，必须返回一个 `新的promise`，并且上一步的成功和失败的消息不能丢失，继续向后传递，这里只做延迟处理。

### stop
用于中断promise链

通常在 `promise链` 中去reject或throw，或者是异常报错信息，promise内部都会使用 `try...catch` 转换为 `reject` 方法往后传递，无法中断后面的 `then` 或其它方法的执行，那么这里利用，`then` 方法中对状态的要求必须不是 `Pending` 状态的处理才会立即执行回调，在 `promise链` 中返回一个初始状态的 `Promise对象`，便可以中断后面回调的执行。

```javascript
Promise.stop = function(){
  return new this();
}
```

使用

```javascript
Promise
  .resolve(1)
  .then(res=>{
	console.log('发生错误，停止后面的执行')
	return Promise.stop();
  })
  .then(res=>console.log(res))
  .catch(err=>console.log(err))
```

### always
无论成功还是失败最终都会调用 `always` 中注册的回调

```javascript
Promise.prototype.always = function(fn){
  return this.then(function(v){
    return fn(v), v;
  }, function(r){
    throw fn(r), r;
  })
}
```
使用

```javascript
ajaxLoadData()
  .then(res=>console.log(res), err=>console.log(err))
  .always(()=>console.log('关闭loading动画'))
```

### done

由于promise在执行 `resolve` 或 `onResolved` 回调时，使用了`try...catch`，并将错误信息，使用 `reject方法` 传递了出去，但是如果后面没有注册处理reject的回调函数，那么错误信息将无法得到处理，进而消失不见，难以查觉，所以有了 `done` 方法。

`done`方法并不返回promise对象，也就是done之后不能使用 `then`或`catch`了，其主要作用就是用于将 `promise链` 中未捕获的异常信息抛至外层，并不会对错误信息进行处理。

**done方法必须应用于promise链的最后**

```javascript
Promise.prototype.done = function(onResolved, onRejected){
  this.then(onResolved, onRejected).catch(function (error) {
      setTimeout(function () {
          throw error;
      }, 0);
  });
}
```

使用

```javascript
ajaxLoadData()
  .then(res=>{
    return new Promise((resolve,reject)=>reject('未捕获的错误'))
  }, err=>console.log(err))
  .always(()=>console.log('关闭loading动画'))
  .done()//这里会将错误信息 '未捕获的错误' 抛至外层
```

### defer
`Deferred` 的简称，叫延迟对象，其实是 `new Promise()` 的语法糖

与Promise的关系
- Deferred 拥有 Promise
- Deferred 具备对 Promise的状态进行操作的特权方法
- Promise 代表了一个对象，这个对象的状态会在未来改变
- Deferred对象 表示了一个处理没有结束，在状态发生改变时，再使用Promise来处理结果

优缺点
- 不用使用大括号将逻辑包起来，少了一层嵌套
- 但是缺少了Promise的错误处理逻辑

```javascript
Promise.deferred = Promise.defer = function(){
  var dfd = {}
  dfd.promise = new this(function(resolve, reject) {
    dfd.resolve = resolve;
    dfd.reject = reject;
  })
  return dfd
}
```

使用

```javascript
function getURL(URL) {
    var deferred = Promise.deferred;
    var req = new XMLHttpRequest();
    req.open('GET', URL, true);
    req.onload = function () {
        if (req.status === 200) {
            deferred.resolve(req.responseText);
        } else {
            deferred.reject(new Error(req.statusText));
        }
    };
    req.onerror = function () {
        deferred.reject(new Error(req.statusText));
    };
    req.send();
    return deferred.promise;
}
```

### timeout
用于判断某些promise任务是否超时
如一个异步请求，如果超时，取消息请求，提示消息或重新请求

```javascript
Promise.timeout = function(promise, ms){
  return this.race([promise, this.reject().wait(ms)]);
}
```
用法

```javascript
function fn4(){
    return new Promise(resolve=> setTimeout(()=>resolve(1), 3000))
}

Promise
    .timeout(fn4(), 2000)
    .then(res=>console.log(res), err=>console.log('超时'))
// 这里 fn4需要3s执行完成，这里只准在2s内完成，fn4的执行时间就超时了，会输出 `超时`
```

### sequence

用于按顺序执行一系列的promise，接收的**函数数组**，并**不是Promise对象数组**，其中**函数执行时就返回Promise对象**，用于有互相依赖的promise任务

```javascript
Promise.sequence = function(tasks){
    return tasks.reduce(function (prev, next) {
        return prev.then(next).then(function(res){ return res });
    }, this.resolve());
}
```
使用

```javascript
function fn1(){ return new Promise(r=>r(1))}
function fn2(data){ return new Promise(r=>r(1+data))}
function fn3(data){ return new Promise(r=>r(1+data))}

Promise.sequence([fn1,fn2,fn3]).then(res=>console.log(res))
//3
```


## 测试

对于自定义的Promise类库，是否符合  [Promise/A+](https://promisesaplus.com/) 的标准呢？

社区有一个开源的[测试脚本](https://github.com/promises-aplus/promises-tests)
只需两步，就能检验我们的实现是否符合标准了

```
//全局安装
npm i -g promises-aplus-tests
//运行测试
promises-aplus-tests Promise.js
```

下面是我们自定义的Promise类库的测试结果，全部通过

![](http://7xi480.com1.z0.glb.clouddn.com/%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202016-12-04%20%E4%B8%8A%E5%8D%889.20.57.png)

