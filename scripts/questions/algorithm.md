---
id: code-001
module: 手写题
difficulty: 1
tags: [防抖, 性能优化]
source: 高频
---
## 题目
手写防抖函数（debounce）

## 答案
## 防抖函数实现

防抖：在事件被触发 n 秒后执行回调，若在 n 秒内再次触发则重新计时。

```js
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 使用
const handleSearch = debounce((val) => {
  console.log('搜索:', val);
}, 500);

input.addEventListener('input', (e) => handleSearch(e.target.value));
```

**支持立即执行的版本：**

```js
function debounce(fn, delay = 300, immediate = false) {
  let timer = null;
  return function (...args) {
    const callNow = immediate && !timer;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);
    if (callNow) fn.apply(this, args);
  };
}
```

---
id: code-002
module: 手写题
difficulty: 1
tags: [节流, 性能优化]
source: 高频
---
## 题目
手写节流函数（throttle）

## 答案
## 节流函数实现

节流：在单位时间内只允许函数执行一次，多余的调用被忽略。

**时间戳版（首次立即执行）：**

```js
function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}
```

**定时器版（首次延迟执行）：**

```js
function throttle(fn, interval = 300) {
  let timer = null;
  return function (...args) {
    if (!timer) {
      timer = setTimeout(() => {
        fn.apply(this, args);
        timer = null;
      }, interval);
    }
  };
}
```

**结合版（首尾都执行）：**

```js
function throttle(fn, interval = 300) {
  let lastTime = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

---
id: code-003
module: 手写题
difficulty: 2
tags: [深拷贝, 对象]
source: 高频
---
## 题目
手写深拷贝（deepClone），需要处理循环引用、Date、RegExp、Map、Set 等特殊类型

## 答案
## 深拷贝实现

```js
function deepClone(target, map = new WeakMap()) {
  // 处理 null 和非对象类型
  if (target === null || typeof target !== 'object') return target;

  // 处理循环引用
  if (map.has(target)) return map.get(target);

  // 处理特殊对象类型
  if (target instanceof Date) return new Date(target.getTime());
  if (target instanceof RegExp) return new RegExp(target.source, target.flags);

  if (target instanceof Map) {
    const clonedMap = new Map();
    map.set(target, clonedMap);
    target.forEach((val, key) => {
      clonedMap.set(deepClone(key, map), deepClone(val, map));
    });
    return clonedMap;
  }

  if (target instanceof Set) {
    const clonedSet = new Set();
    map.set(target, clonedSet);
    target.forEach((val) => clonedSet.add(deepClone(val, map)));
    return clonedSet;
  }

  // 处理数组和普通对象
  const cloned = Array.isArray(target) ? [] : {};
  map.set(target, cloned);

  for (const key of Reflect.ownKeys(target)) {
    cloned[key] = deepClone(target[key], map);
  }

  return cloned;
}

// 测试
const obj = { a: 1, b: { c: 2 }, d: [1, 2, 3] };
obj.self = obj; // 循环引用
const cloned = deepClone(obj);
console.log(cloned.b === obj.b); // false
console.log(cloned.self === cloned); // true（保持循环引用结构）
```

---
id: code-004
module: 手写题
difficulty: 2
tags: [Promise, 异步]
source: 高频
---
## 题目
手写 Promise.all

## 答案
## Promise.all 实现

```js
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      return reject(new TypeError('promises must be an array'));
    }

    const results = [];
    let count = 0;
    const total = promises.length;

    if (total === 0) return resolve([]);

    promises.forEach((p, index) => {
      Promise.resolve(p).then((val) => {
        results[index] = val;
        count++;
        if (count === total) resolve(results);
      }).catch(reject);
    });
  });
}

// 测试
promiseAll([
  Promise.resolve(1),
  Promise.resolve(2),
  new Promise(r => setTimeout(() => r(3), 100))
]).then(console.log); // [1, 2, 3]

promiseAll([Promise.resolve(1), Promise.reject('err')])
  .catch(console.error); // 'err'
```

**关键点：**
- 空数组直接 resolve `[]`
- 用 `index` 而非 push 保证顺序
- 任一 reject 即 reject 整体
- 用 `Promise.resolve(p)` 包装非 Promise 值

---
id: code-005
module: 手写题
difficulty: 2
tags: [Promise, 异步]
source: 高频
---
## 题目
手写 Promise.allSettled

## 答案
## Promise.allSettled 实现

与 `Promise.all` 的区别：无论成功还是失败，都等待所有 Promise 完成，返回每个结果的状态描述对象。

```js
function promiseAllSettled(promises) {
  return new Promise((resolve) => {
    if (!Array.isArray(promises)) {
      return resolve([]);
    }

    const results = [];
    let count = 0;
    const total = promises.length;

    if (total === 0) return resolve([]);

    promises.forEach((p, index) => {
      Promise.resolve(p)
        .then((value) => {
          results[index] = { status: 'fulfilled', value };
        })
        .catch((reason) => {
          results[index] = { status: 'rejected', reason };
        })
        .finally(() => {
          count++;
          if (count === total) resolve(results);
        });
    });
  });
}

// 测试
promiseAllSettled([
  Promise.resolve(1),
  Promise.reject('error'),
  Promise.resolve(3),
]).then(console.log);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: 'error' },
//   { status: 'fulfilled', value: 3 }
// ]
```

---
id: code-006
module: 手写题
difficulty: 2
tags: [Promise, 异步]
source: 高频
---
## 题目
手写 Promise.race 和 Promise.any

## 答案
## Promise.race 和 Promise.any 实现

**Promise.race —— 第一个完成（无论成功失败）即返回：**

```js
function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    promises.forEach((p) => {
      Promise.resolve(p).then(resolve).catch(reject);
    });
  });
}
```

**Promise.any —— 第一个成功即返回，全部失败才 reject：**

```js
function promiseAny(promises) {
  return new Promise((resolve, reject) => {
    if (!promises.length) {
      return reject(new AggregateError([], 'All promises were rejected'));
    }

    const errors = [];
    let rejectedCount = 0;

    promises.forEach((p, index) => {
      Promise.resolve(p)
        .then(resolve)
        .catch((err) => {
          errors[index] = err;
          rejectedCount++;
          if (rejectedCount === promises.length) {
            reject(new AggregateError(errors, 'All promises were rejected'));
          }
        });
    });
  });
}
```

---
id: code-007
module: 手写题
difficulty: 2
tags: [Promise, 异步]
source: 高频
---
## 题目
手写一个完整的 Promise（符合 Promises/A+ 规范）

## 答案
## 手写 Promise

```js
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  #state = PENDING;
  #value = undefined;
  #callbacks = [];

  constructor(executor) {
    const resolve = (value) => {
      if (this.#state !== PENDING) return;
      // 若 resolve 的是一个 Promise，需要等待它
      if (value instanceof MyPromise) {
        value.then(resolve, reject);
        return;
      }
      this.#state = FULFILLED;
      this.#value = value;
      this.#callbacks.forEach(({ onFulfilled }) => onFulfilled(value));
    };

    const reject = (reason) => {
      if (this.#state !== PENDING) return;
      this.#state = REJECTED;
      this.#value = reason;
      this.#callbacks.forEach(({ onRejected }) => onRejected(reason));
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (v) => v;
    onRejected = typeof onRejected === 'function' ? onRejected : (r) => { throw r; };

    return new MyPromise((resolve, reject) => {
      const handle = (fn, val) => {
        // Promises/A+ 要求异步执行
        queueMicrotask(() => {
          try {
            const result = fn(val);
            if (result instanceof MyPromise) {
              result.then(resolve, reject);
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(e);
          }
        });
      };

      if (this.#state === FULFILLED) {
        handle(onFulfilled, this.#value);
      } else if (this.#state === REJECTED) {
        handle(onRejected, this.#value);
      } else {
        this.#callbacks.push({
          onFulfilled: (val) => handle(onFulfilled, val),
          onRejected: (val) => handle(onRejected, val),
        });
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (val) => MyPromise.resolve(onFinally()).then(() => val),
      (err) => MyPromise.resolve(onFinally()).then(() => { throw err; }),
    );
  }

  static resolve(value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }
}
```

---
id: code-008
module: 手写题
difficulty: 1
tags: [Function, call, apply, bind]
source: 高频
---
## 题目
手写 Function.prototype.call、apply、bind

## 答案
## call / apply / bind 实现

**call：**

```js
Function.prototype.myCall = function (context, ...args) {
  context = context == null ? globalThis : Object(context);
  const sym = Symbol('fn');
  context[sym] = this;
  const result = context[sym](...args);
  delete context[sym];
  return result;
};
```

**apply：**

```js
Function.prototype.myApply = function (context, args = []) {
  context = context == null ? globalThis : Object(context);
  const sym = Symbol('fn');
  context[sym] = this;
  const result = context[sym](...args);
  delete context[sym];
  return result;
};
```

**bind：**

```js
Function.prototype.myBind = function (context, ...outerArgs) {
  const fn = this;
  return function BoundFn(...innerArgs) {
    // 若通过 new 调用，忽略绑定的 context
    if (new.target) {
      return new fn(...outerArgs, ...innerArgs);
    }
    return fn.apply(context, [...outerArgs, ...innerArgs]);
  };
};

// 测试
function greet(greeting, name) {
  return `${greeting}, ${name}! I am ${this.role}`;
}
const obj = { role: 'admin' };
console.log(greet.myCall(obj, 'Hello', 'Alice'));  // Hello, Alice! I am admin
console.log(greet.myApply(obj, ['Hi', 'Bob']));    // Hi, Bob! I am admin
const bound = greet.myBind(obj, 'Hey');
console.log(bound('Charlie')); // Hey, Charlie! I am admin
```

---
id: code-009
module: 手写题
difficulty: 1
tags: [new, 原型链]
source: 高频
---
## 题目
手写 new 操作符

## 答案
## 手写 new

`new` 做了以下四件事：
1. 创建一个空对象，原型指向构造函数的 `prototype`
2. 将构造函数的 `this` 指向新对象并执行
3. 若构造函数返回了对象，则返回该对象；否则返回新对象

```js
function myNew(Constructor, ...args) {
  // 1. 创建对象，设置原型
  const obj = Object.create(Constructor.prototype);

  // 2. 执行构造函数
  const result = Constructor.apply(obj, args);

  // 3. 若构造函数显式返回了对象，则使用该对象
  return result !== null && typeof result === 'object' ? result : obj;
}

// 测试
function Person(name, age) {
  this.name = name;
  this.age = age;
}
Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}`;
};

const p = myNew(Person, 'Alice', 25);
console.log(p instanceof Person); // true
console.log(p.greet());           // Hi, I'm Alice
```

---
id: code-010
module: 手写题
difficulty: 1
tags: [instanceof, 原型链]
source: 高频
---
## 题目
手写 instanceof

## 答案
## 手写 instanceof

`instanceof` 沿着左侧对象的原型链向上查找，直到找到右侧构造函数的 `prototype`。

```js
function myInstanceof(left, right) {
  // 基本类型直接返回 false
  if (typeof left !== 'object' || left === null) return false;

  let proto = Object.getPrototypeOf(left);
  const prototype = right.prototype;

  while (proto !== null) {
    if (proto === prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }

  return false;
}

// 测试
console.log(myInstanceof([], Array));        // true
console.log(myInstanceof([], Object));       // true
console.log(myInstanceof({}, Array));        // false
console.log(myInstanceof('str', String));    // false（基本类型）

function Animal() {}
function Dog() {}
Dog.prototype = Object.create(Animal.prototype);
const d = new Dog();
console.log(myInstanceof(d, Dog));    // true
console.log(myInstanceof(d, Animal)); // true
```

---
id: code-011
module: 手写题
difficulty: 2
tags: [数组, flat]
source: 高频
---
## 题目
手写 Array.prototype.flat（数组扁平化）

## 答案
## 数组扁平化实现

```js
// 方法1：递归实现（支持指定深度）
function myFlat(arr, depth = 1) {
  if (depth === 0) return arr.slice();
  return arr.reduce((acc, item) => {
    if (Array.isArray(item) && depth > 0) {
      acc.push(...myFlat(item, depth - 1));
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
}

// 方法2：无限深度（全部扁平化）
function flatInfinity(arr) {
  return arr.reduce(
    (acc, item) =>
      Array.isArray(item) ? acc.concat(flatInfinity(item)) : acc.concat(item),
    [],
  );
}

// 方法3：栈实现（迭代，无栈溢出风险）
function flatIterative(arr) {
  const stack = [...arr];
  const result = [];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) {
      stack.push(...item);
    } else {
      result.unshift(item); // 用 unshift 保证顺序
    }
  }
  return result;
}

// 测试
const arr = [1, [2, [3, [4]], 5]];
console.log(myFlat(arr, 1));        // [1, 2, [3, [4]], 5]
console.log(myFlat(arr, 2));        // [1, 2, 3, [4], 5]
console.log(myFlat(arr, Infinity)); // [1, 2, 3, 4, 5]
```

---
id: code-012
module: 手写题
difficulty: 2
tags: [数组, reduce]
source: 高频
---
## 题目
手写 Array.prototype.reduce

## 答案
## 手写 reduce

```js
Array.prototype.myReduce = function (callback, initialValue) {
  if (typeof callback !== 'function') {
    throw new TypeError(`${callback} is not a function`);
  }

  const arr = this;
  const len = arr.length;
  let index = 0;
  let acc;

  if (arguments.length >= 2) {
    acc = initialValue;
  } else {
    // 无初始值时，从第一个非空元素开始
    if (len === 0) throw new TypeError('Reduce of empty array with no initial value');
    while (index < len && !(index in arr)) index++;
    if (index >= len) throw new TypeError('Reduce of empty array with no initial value');
    acc = arr[index++];
  }

  while (index < len) {
    if (index in arr) {
      acc = callback(acc, arr[index], index, arr);
    }
    index++;
  }

  return acc;
};

// 测试
console.log([1,2,3,4].myReduce((acc, cur) => acc + cur, 0)); // 10
console.log([1,2,3].myReduce((acc, cur) => acc * cur));       // 6
```

---
id: code-013
module: 手写题
difficulty: 1
tags: [数组, map]
source: 高频
---
## 题目
手写 Array.prototype.map、filter、find

## 答案
## 手写 map / filter / find

```js
// map
Array.prototype.myMap = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this) {
      result[i] = callback.call(thisArg, this[i], i, this);
    }
  }
  return result;
};

// filter
Array.prototype.myFilter = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      result.push(this[i]);
    }
  }
  return result;
};

// find
Array.prototype.myFind = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return this[i];
    }
  }
  return undefined;
};

// 测试
console.log([1,2,3].myMap(x => x * 2));          // [2, 4, 6]
console.log([1,2,3,4].myFilter(x => x % 2 === 0)); // [2, 4]
console.log([1,2,3].myFind(x => x > 1));           // 2
```

---
id: code-014
module: 手写题
difficulty: 2
tags: [发布订阅, 设计模式]
source: 高频
---
## 题目
手写发布订阅模式（EventEmitter）

## 答案
## 发布订阅模式实现

```js
class EventEmitter {
  constructor() {
    this._events = Object.create(null);
  }

  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(listener);
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener.apply(this, args);
      this.off(event, wrapper);
    };
    wrapper._original = listener;
    return this.on(event, wrapper);
  }

  off(event, listener) {
    if (!this._events[event]) return this;
    this._events[event] = this._events[event].filter(
      (fn) => fn !== listener && fn._original !== listener,
    );
    return this;
  }

  emit(event, ...args) {
    if (!this._events[event]) return false;
    // 拷贝一份防止在回调中修改数组导致问题
    [...this._events[event]].forEach((fn) => fn.apply(this, args));
    return true;
  }

  removeAllListeners(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = Object.create(null);
    }
    return this;
  }

  listenerCount(event) {
    return this._events[event]?.length ?? 0;
  }
}

// 测试
const emitter = new EventEmitter();
emitter.on('data', (msg) => console.log('A:', msg));
emitter.once('data', (msg) => console.log('B:', msg));
emitter.emit('data', 'hello'); // A: hello  B: hello
emitter.emit('data', 'world'); // A: world（B 只触发一次）
```

---
id: code-015
module: 手写题
difficulty: 2
tags: [观察者模式, 设计模式]
source: 高频
---
## 题目
手写观察者模式，并说明与发布订阅模式的区别

## 答案
## 观察者模式实现

```js
// 被观察者（Subject）
class Subject {
  constructor() {
    this.observers = [];
    this.state = null;
  }

  attach(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer) {
    this.observers = this.observers.filter((o) => o !== observer);
  }

  setState(newState) {
    this.state = newState;
    this.notify();
  }

  notify() {
    this.observers.forEach((observer) => observer.update(this));
  }
}

// 观察者（Observer）
class Observer {
  constructor(name) {
    this.name = name;
  }

  update(subject) {
    console.log(`${this.name} 收到更新，新状态: ${subject.state}`);
  }
}

// 测试
const subject = new Subject();
const obs1 = new Observer('观察者A');
const obs2 = new Observer('观察者B');
subject.attach(obs1);
subject.attach(obs2);
subject.setState('loading'); // 观察者A 收到更新  观察者B 收到更新
subject.detach(obs1);
subject.setState('done');    // 仅观察者B 收到更新
```

**与发布订阅的区别：**

| 对比项 | 观察者模式 | 发布订阅模式 |
|--------|-----------|-------------|
| 耦合度 | 观察者与主题直接引用 | 通过事件中心解耦 |
| 通信 | 主题直接通知观察者 | 发布者不知道订阅者的存在 |
| 适用 | 简单一对多依赖 | 跨模块/跨组件通信 |

---
id: code-016
module: 手写题
difficulty: 2
tags: [LRU, 缓存, 数据结构]
source: 高频
---
## 题目
手写 LRU 缓存（最近最少使用）

## 答案
## LRU 缓存实现

利用 `Map` 的插入有序性，实现 O(1) 的 get 和 put：

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    // 刷新为最近使用：删除再重新插入
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // 删除最久未使用的（Map 的第一个元素）
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }
}

// 测试（LeetCode 146）
const lru = new LRUCache(2);
lru.put(1, 1);
lru.put(2, 2);
console.log(lru.get(1)); // 1
lru.put(3, 3);           // 淘汰 key=2
console.log(lru.get(2)); // -1
lru.put(4, 4);           // 淘汰 key=1
console.log(lru.get(1)); // -1
console.log(lru.get(3)); // 3
console.log(lru.get(4)); // 4
```

---
id: code-017
module: 手写题
difficulty: 3
tags: [虚拟DOM, diff]
source: 高频
---
## 题目
手写简单的虚拟 DOM 和 diff 算法

## 答案
## 虚拟 DOM 与 diff 实现

```js
// 创建虚拟节点
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children.flat(),
  };
}

// 虚拟 DOM 渲染为真实 DOM
function render(vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }

  const el = document.createElement(vnode.type);

  // 设置属性
  for (const [key, val] of Object.entries(vnode.props)) {
    if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else {
      el.setAttribute(key, val);
    }
  }

  // 渲染子节点
  vnode.children.forEach((child) => el.appendChild(render(child)));

  return el;
}

// 简单 diff（同层比较）
function patch(parent, oldVnode, newVnode, index = 0) {
  const el = parent.childNodes[index];

  // 旧节点不存在：新增
  if (!oldVnode) {
    parent.appendChild(render(newVnode));
    return;
  }
  // 新节点不存在：删除
  if (!newVnode) {
    parent.removeChild(el);
    return;
  }
  // 都是文本节点
  if (typeof oldVnode !== typeof newVnode ||
      (typeof oldVnode === 'string' && oldVnode !== newVnode)) {
    parent.replaceChild(render(newVnode), el);
    return;
  }
  // 类型不同：替换
  if (oldVnode.type !== newVnode.type) {
    parent.replaceChild(render(newVnode), el);
    return;
  }

  // 类型相同：更新 props
  updateProps(el, oldVnode.props, newVnode.props);

  // 递归 diff 子节点
  const oldLen = oldVnode.children.length;
  const newLen = newVnode.children.length;
  const maxLen = Math.max(oldLen, newLen);
  for (let i = 0; i < maxLen; i++) {
    patch(el, oldVnode.children[i], newVnode.children[i], i);
  }
}

function updateProps(el, oldProps, newProps) {
  // 删除旧 props
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) el.removeAttribute(key);
  }
  // 更新/新增 props
  for (const [key, val] of Object.entries(newProps)) {
    if (oldProps[key] !== val) el.setAttribute(key, val);
  }
}

// 使用
const vdom1 = h('div', { class: 'box' }, h('p', null, 'Hello'), 'World');
const vdom2 = h('div', { class: 'box active' }, h('p', null, 'Hi'), 'World');
const container = document.getElementById('app');
container.appendChild(render(vdom1));
patch(container, vdom1, vdom2);
```

---
id: code-018
module: 手写题
difficulty: 3
tags: [curry, 函数式编程]
source: 高频
---
## 题目
手写函数柯里化（curry）

## 答案
## 柯里化实现

```js
// 通用柯里化
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

// 测试
function add(a, b, c) {
  return a + b + c;
}
const curriedAdd = curry(add);
console.log(curriedAdd(1)(2)(3));     // 6
console.log(curriedAdd(1, 2)(3));     // 6
console.log(curriedAdd(1)(2, 3));     // 6
console.log(curriedAdd(1, 2, 3));     // 6

// 支持占位符的柯里化
const _ = Symbol('placeholder');
function curryWithPlaceholder(fn) {
  const arity = fn.length;
  return function curried(...args) {
    // 检查是否有足够的非占位符参数
    const realArgs = args.filter((a) => a !== _);
    if (realArgs.length >= arity) {
      return fn(...args.filter((a) => a !== _));
    }
    return function (...newArgs) {
      // 用新参数填充占位符
      const merged = args.map((a) => (a === _ && newArgs.length ? newArgs.shift() : a));
      return curried(...merged, ...newArgs);
    };
  };
}
```

---
id: code-019
module: 手写题
difficulty: 2
tags: [compose, pipe, 函数式编程]
source: 高频
---
## 题目
手写函数组合（compose 和 pipe）

## 答案
## compose 和 pipe 实现

```js
// compose：从右到左执行
function compose(...fns) {
  if (fns.length === 0) return (x) => x;
  if (fns.length === 1) return fns[0];
  return fns.reduce((f, g) => (...args) => f(g(...args)));
}

// pipe：从左到右执行（compose 的镜像）
function pipe(...fns) {
  if (fns.length === 0) return (x) => x;
  if (fns.length === 1) return fns[0];
  return fns.reduce((f, g) => (...args) => g(f(...args)));
}

// 测试
const double = (x) => x * 2;
const addOne = (x) => x + 1;
const square = (x) => x * x;

const transform1 = compose(square, addOne, double); // square(addOne(double(x)))
console.log(transform1(3)); // square(addOne(6)) = square(7) = 49

const transform2 = pipe(double, addOne, square); // 同样的逻辑，从左到右
console.log(transform2(3)); // square(addOne(double(3))) = 49

// Redux 中的 compose 实现（处理空和单个 fn 的边界情况）
function reduxCompose(...funcs) {
  if (funcs.length === 0) return (arg) => arg;
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
```

---
id: code-020
module: 手写题
difficulty: 2
tags: [继承, 原型链, ES5]
source: 高频
---
## 题目
手写 ES5 寄生组合式继承

## 答案
## 寄生组合式继承

ES5 中最优的继承方式，避免了组合继承中调用两次父构造函数的问题。

```js
function Animal(name) {
  this.name = name;
  this.colors = ['black', 'white'];
}
Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound`);
};

function Dog(name, breed) {
  // 1. 借用构造函数（继承实例属性）
  Animal.call(this, name);
  this.breed = breed;
}

// 2. 寄生：创建父类原型的副本，避免调用父构造函数
function inheritPrototype(Child, Parent) {
  const proto = Object.create(Parent.prototype);  // 创建副本
  proto.constructor = Child;                       // 修复 constructor
  Child.prototype = proto;
}

inheritPrototype(Dog, Animal);

// 3. 在子类原型上添加方法
Dog.prototype.bark = function () {
  console.log(`${this.name} barks!`);
};

// 测试
const d1 = new Dog('Rex', 'Husky');
const d2 = new Dog('Max', 'Lab');
d1.colors.push('brown');
console.log(d1.colors); // ['black', 'white', 'brown']（不影响 d2）
console.log(d2.colors); // ['black', 'white']
console.log(d1 instanceof Dog);    // true
console.log(d1 instanceof Animal); // true
d1.speak(); // Rex makes a sound
d1.bark();  // Rex barks!
```

---
id: code-021
module: 手写题
difficulty: 2
tags: [路由, 前端路由]
source: 高频
---
## 题目
手写前端路由（Hash 路由和 History 路由）

## 答案
## 前端路由实现

**Hash 路由：**

```js
class HashRouter {
  constructor() {
    this.routes = {};
    this.currentPath = '';
    window.addEventListener('hashchange', this._handleChange.bind(this));
    window.addEventListener('load', this._handleChange.bind(this));
  }

  _handleChange() {
    this.currentPath = window.location.hash.slice(1) || '/';
    this._render();
  }

  register(path, callback) {
    this.routes[path] = callback;
    return this;
  }

  _render() {
    const cb = this.routes[this.currentPath] || this.routes['*'];
    cb?.();
  }

  navigate(path) {
    window.location.hash = path;
  }
}
```

**History 路由：**

```js
class HistoryRouter {
  constructor() {
    this.routes = {};
    window.addEventListener('popstate', this._handleChange.bind(this));
  }

  _handleChange(e) {
    this._render(window.location.pathname);
  }

  register(path, callback) {
    this.routes[path] = callback;
    return this;
  }

  push(path, state = {}) {
    window.history.pushState(state, '', path);
    this._render(path);
  }

  replace(path, state = {}) {
    window.history.replaceState(state, '', path);
    this._render(path);
  }

  _render(path) {
    // 简单匹配，实际应该支持动态路由
    const cb = this.routes[path] || this.routes['*'];
    cb?.();
  }
}
```

---
id: code-022
module: 手写题
difficulty: 3
tags: [状态管理, Proxy]
source: 高频
---
## 题目
手写简版响应式状态管理（类似 Vuex / Zustand）

## 答案
## 简版响应式状态管理

```js
function createStore(initialState, reducers) {
  let state = { ...initialState };
  const listeners = new Set();

  // 订阅
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener); // 返回取消订阅函数
  }

  // 获取状态
  function getState() {
    return state;
  }

  // 派发 action
  function dispatch(action) {
    const reducer = reducers[action.type];
    if (!reducer) throw new Error(`Unknown action: ${action.type}`);
    state = reducer(state, action.payload);
    listeners.forEach((fn) => fn(state));
  }

  return { getState, dispatch, subscribe };
}

// 使用
const store = createStore(
  { count: 0, user: null },
  {
    INCREMENT: (state, payload) => ({ ...state, count: state.count + (payload ?? 1) }),
    DECREMENT: (state, payload) => ({ ...state, count: state.count - (payload ?? 1) }),
    SET_USER: (state, payload) => ({ ...state, user: payload }),
  },
);

const unsubscribe = store.subscribe((newState) => {
  console.log('State changed:', newState);
});

store.dispatch({ type: 'INCREMENT' });        // count: 1
store.dispatch({ type: 'INCREMENT', payload: 5 }); // count: 6
unsubscribe(); // 取消订阅
store.dispatch({ type: 'DECREMENT' });        // 不再触发监听器
```

---
id: code-023
module: 手写题
difficulty: 2
tags: [并发控制, Promise, 异步]
source: 高频
---
## 题目
手写并发请求控制（限制同时执行的 Promise 数量）

## 答案
## 并发控制实现

```js
// 方式1：限制并发数的 Promise 池
async function promisePool(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const [index, task] of tasks.entries()) {
    const p = Promise.resolve().then(() => task()).then((res) => {
      results[index] = res;
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// 方式2：更常用的类封装
class RequestQueue {
  constructor(limit = 3) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.limit && this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }
}

// 测试
const queue = new RequestQueue(2);
const delay = (ms, val) => new Promise((r) => setTimeout(() => r(val), ms));

queue.add(() => delay(1000, 'A')).then(console.log);
queue.add(() => delay(500, 'B')).then(console.log);
queue.add(() => delay(300, 'C')).then(console.log);
// 先输出 B（500ms），再输出 C（300ms + 等待A释放），最后 A（1000ms）
```

---
id: code-024
module: 手写题
difficulty: 2
tags: [异步, 串行, 队列]
source: 高频
---
## 题目
手写异步任务串行调度器（实现 add 方法和 start 方法）

## 答案
## 异步任务串行调度器

```js
class AsyncScheduler {
  constructor() {
    this.tasks = [];
  }

  add(asyncFn) {
    this.tasks.push(asyncFn);
    return this; // 支持链式调用
  }

  async start() {
    const results = [];
    for (const task of this.tasks) {
      const result = await task();
      results.push(result);
    }
    return results;
  }
}

// 链式调用版本（类似 then 链）
class PromiseChain {
  constructor() {
    this._promise = Promise.resolve();
  }

  next(fn) {
    this._promise = this._promise.then(fn);
    return this;
  }

  run() {
    return this._promise;
  }
}

// 测试
const scheduler = new AsyncScheduler();
const delay = (ms, val) => () => new Promise((r) => setTimeout(() => r(val), ms));

scheduler
  .add(delay(300, 'first'))
  .add(delay(100, 'second'))
  .add(delay(200, 'third'));

scheduler.start().then(console.log); // ['first', 'second', 'third']
// 依次串行：300ms + 100ms + 200ms = 600ms 完成
```

---
id: code-025
module: 手写题
difficulty: 2
tags: [对象, Object]
source: 高频
---
## 题目
手写 Object.create、Object.assign

## 答案
## Object.create 和 Object.assign 实现

**Object.create：**

```js
function myObjectCreate(proto, propertiesObject) {
  if (typeof proto !== 'object' && typeof proto !== 'function') {
    throw new TypeError('Object prototype may only be an Object or null');
  }

  function F() {}
  F.prototype = proto;
  const obj = new F();

  if (propertiesObject !== undefined) {
    Object.defineProperties(obj, propertiesObject);
  }

  return obj;
}
```

**Object.assign：**

```js
function myObjectAssign(target, ...sources) {
  if (target == null) {
    throw new TypeError('Cannot convert undefined or null to object');
  }

  const to = Object(target);

  for (const source of sources) {
    if (source == null) continue;
    // 仅遍历自身可枚举属性（包括 Symbol）
    for (const key of Reflect.ownKeys(source)) {
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (desc && desc.enumerable) {
        to[key] = source[key];
      }
    }
  }

  return to;
}

// 测试
const obj1 = myObjectCreate({ greet() { return 'hi'; } });
console.log(obj1.greet()); // 'hi'

const result = myObjectAssign({}, { a: 1 }, { b: 2, a: 3 });
console.log(result); // { a: 3, b: 2 }
```

---
id: code-026
module: 手写题
difficulty: 2
tags: [字符串, 模板引擎]
source: 高频
---
## 题目
手写简单模板引擎（支持 {{ variable }} 和 {{#if}} {{/if}} 等逻辑）

## 答案
## 简单模板引擎实现

```js
// 基础版：支持变量替换
function template(tpl, data) {
  return tpl.replace(/\{\{(\s*\w+\s*)\}\}/g, (match, key) => {
    const val = data[key.trim()];
    return val !== undefined ? val : '';
  });
}

// 完整版：支持嵌套属性、if 和 each
function renderTemplate(tpl, data) {
  // 处理 {{#each items}}...{{/each}}
  tpl = tpl.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, key, inner) => {
      const list = data[key];
      if (!Array.isArray(list)) return '';
      return list.map((item) => renderTemplate(inner, { ...data, ...item, this: item })).join('');
    },
  );

  // 处理 {{#if key}}...{{/if}}
  tpl = tpl.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, inner) => (data[key] ? renderTemplate(inner, data) : ''),
  );

  // 处理变量替换（支持 a.b.c 嵌套）
  tpl = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const val = path.split('.').reduce((obj, k) => obj?.[k], data);
    return val ?? '';
  });

  return tpl;
}

// 测试
const tpl = `
  <h1>{{title}}</h1>
  {{#if isAdmin}}<p>管理员</p>{{/if}}
  <ul>
    {{#each users}}
    <li>{{name}} - {{age}}</li>
    {{/each}}
  </ul>
`;
const result = renderTemplate(tpl, {
  title: 'Hello',
  isAdmin: true,
  users: [{ name: 'Alice', age: 25 }, { name: 'Bob', age: 30 }],
});
```

---
id: code-027
module: 手写题
difficulty: 2
tags: [JSONP, 网络]
source: 高频
---
## 题目
手写 JSONP 实现

## 答案
## JSONP 实现

```js
function jsonp(url, params = {}, callbackName = 'callback') {
  return new Promise((resolve, reject) => {
    // 生成唯一的回调函数名
    const cbName = `jsonp_${callbackName}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 构建 URL（加上 callback 参数）
    const queryStr = new URLSearchParams({
      ...params,
      [callbackName]: cbName,
    }).toString();
    const fullUrl = `${url}?${queryStr}`;

    // 挂载到全局供服务端回调使用
    window[cbName] = (data) => {
      resolve(data);
      cleanup();
    };

    // 创建 script 标签
    const script = document.createElement('script');
    script.src = fullUrl;
    script.onerror = () => {
      reject(new Error(`JSONP request failed: ${fullUrl}`));
      cleanup();
    };

    document.head.appendChild(script);

    function cleanup() {
      delete window[cbName];
      document.head.removeChild(script);
    }
  });
}

// 使用
jsonp('https://api.example.com/data', { id: 123 })
  .then((data) => console.log(data))
  .catch(console.error);
```

**JSONP 原理：** `script` 标签不受同源策略限制，服务器返回形如 `callback({"key":"value"})` 的 JS 代码并执行。

**缺点：** 只支持 GET、无法处理 HTTP 错误状态码、有 XSS 风险。

---
id: code-028
module: 手写题
difficulty: 2
tags: [ajax, XMLHttpRequest, 网络]
source: 高频
---
## 题目
手写 Ajax 封装（基于 XMLHttpRequest）

## 答案
## Ajax 封装实现

```js
function ajax({
  url,
  method = 'GET',
  data = null,
  headers = {},
  timeout = 0,
  withCredentials = false,
}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 处理查询字符串（GET 请求）
    let fullUrl = url;
    if (method.toUpperCase() === 'GET' && data) {
      const qs = new URLSearchParams(data).toString();
      fullUrl = `${url}?${qs}`;
    }

    xhr.open(method.toUpperCase(), fullUrl, true);

    // 设置请求头
    for (const [key, val] of Object.entries(headers)) {
      xhr.setRequestHeader(key, val);
    }

    // POST 默认 Content-Type
    if (method.toUpperCase() !== 'GET' && !headers['Content-Type']) {
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    }

    if (timeout) xhr.timeout = timeout;
    xhr.withCredentials = withCredentials;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`Request failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));

    const body = method.toUpperCase() === 'GET'
      ? null
      : typeof data === 'string' ? data : JSON.stringify(data);

    xhr.send(body);
  });
}
```

---
id: code-029
module: 手写题
difficulty: 2
tags: [图片懒加载, IntersectionObserver]
source: 高频
---
## 题目
手写图片懒加载（使用 IntersectionObserver 和传统方式两种实现）

## 答案
## 图片懒加载实现

**IntersectionObserver 版（推荐）：**

```js
function lazyLoadImages(selector = 'img[data-src]') {
  const images = document.querySelectorAll(selector);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: '100px 0px', // 提前 100px 开始加载
      threshold: 0.01,
    },
  );

  images.forEach((img) => observer.observe(img));
}
```

**传统滚动监听版：**

```js
function lazyLoadScroll() {
  const images = [...document.querySelectorAll('img[data-src]')];

  function loadVisible() {
    const viewHeight = window.innerHeight || document.documentElement.clientHeight;
    images.forEach((img) => {
      if (!img.dataset.src) return;
      const rect = img.getBoundingClientRect();
      if (rect.top < viewHeight + 100) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
    });
  }

  const throttledLoad = throttle(loadVisible, 200);
  window.addEventListener('scroll', throttledLoad);
  loadVisible(); // 初始加载
}
```

---
id: code-030
module: 手写题
difficulty: 2
tags: [虚拟滚动, 性能]
source: 高频
---
## 题目
手写虚拟滚动列表（Virtual Scroll）

## 答案
## 虚拟滚动实现

核心思路：只渲染可见区域的 DOM，通过 transform 偏移模拟滚动位置。

```js
class VirtualScroll {
  constructor({ container, itemHeight, total, renderItem }) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.total = total;
    this.renderItem = renderItem;

    this.scrollTop = 0;
    this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2; // 多渲染 2 条缓冲

    this._init();
  }

  _init() {
    // 撑开滚动高度
    this.phantom = document.createElement('div');
    this.phantom.style.height = `${this.total * this.itemHeight}px`;
    this.phantom.style.position = 'absolute';
    this.phantom.style.top = '0';
    this.phantom.style.left = '0';
    this.phantom.style.width = '100%';
    this.phantom.style.zIndex = '-1';

    // 实际渲染容器
    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.width = '100%';

    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    this.container.appendChild(this.phantom);
    this.container.appendChild(this.content);

    this.container.addEventListener('scroll', this._onScroll.bind(this));
    this._render();
  }

  _onScroll() {
    this.scrollTop = this.container.scrollTop;
    this._render();
  }

  _render() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleCount, this.total);

    const offsetY = startIndex * this.itemHeight;
    this.content.style.transform = `translateY(${offsetY}px)`;

    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const el = this.renderItem(i);
      fragment.appendChild(el);
    }

    this.content.innerHTML = '';
    this.content.appendChild(fragment);
  }
}

// 使用
const vs = new VirtualScroll({
  container: document.getElementById('list'),
  itemHeight: 50,
  total: 10000,
  renderItem: (index) => {
    const div = document.createElement('div');
    div.style.height = '50px';
    div.textContent = `Item ${index}`;
    return div;
  },
});
```

---
id: code-031
module: 手写题
difficulty: 2
tags: [字符串, 算法]
source: 高频
---
## 题目
手写字符串相关常见题：驼峰转短横线、千分位格式化、URL 解析

## 答案
## 字符串常见手写题

**驼峰 ↔ 短横线：**

```js
// camelCase → kebab-case
const toKebab = (str) =>
  str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');

// kebab-case → camelCase
const toCamel = (str) =>
  str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

console.log(toKebab('backgroundColor')); // 'background-color'
console.log(toCamel('background-color')); // 'backgroundColor'
```

**千分位格式化：**

```js
// 方法1：toLocaleString
(1234567.89).toLocaleString('zh-CN'); // '1,234,567.89'

// 方法2：正则
function formatNumber(num) {
  const [int, dec] = String(num).split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${formatted}.${dec}` : formatted;
}
console.log(formatNumber(1234567.89)); // '1,234,567.89'
```

**解析 URL 参数：**

```js
function parseQuery(url) {
  const query = url.includes('?') ? url.split('?')[1] : url;
  return Object.fromEntries(new URLSearchParams(query));
}

// 处理同名参数
function parseQueryMulti(url) {
  const params = {};
  new URLSearchParams(url.split('?')[1]).forEach((val, key) => {
    if (key in params) {
      params[key] = [].concat(params[key], val);
    } else {
      params[key] = val;
    }
  });
  return params;
}

console.log(parseQuery('http://a.com?id=1&name=Alice'));
// { id: '1', name: 'Alice' }
```

---
id: code-032
module: 手写题
difficulty: 2
tags: [排序, 算法]
source: 高频
---
## 题目
手写快速排序和归并排序

## 答案
## 快速排序和归并排序

**快速排序：**

```js
function quickSort(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter((x) => x < pivot);
  const mid = arr.filter((x) => x === pivot);
  const right = arr.filter((x) => x > pivot);

  return [...quickSort(left), ...mid, ...quickSort(right)];
}

// 原地版（高效，O(1) 空间）
function quickSortInPlace(arr, lo = 0, hi = arr.length - 1) {
  if (lo >= hi) return;
  const p = partition(arr, lo, hi);
  quickSortInPlace(arr, lo, p - 1);
  quickSortInPlace(arr, p + 1, hi);
}
function partition(arr, lo, hi) {
  const pivot = arr[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (arr[j] <= pivot) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i++;
    }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];
  return i;
}
```

**归并排序：**

```js
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  return [...result, ...left.slice(i), ...right.slice(j)];
}

console.log(quickSort([3, 1, 4, 1, 5, 9, 2, 6])); // [1, 1, 2, 3, 4, 5, 6, 9]
console.log(mergeSort([3, 1, 4, 1, 5, 9, 2, 6])); // [1, 1, 2, 3, 4, 5, 6, 9]
```

---
id: code-033
module: 手写题
difficulty: 2
tags: [二分查找, 算法]
source: 高频
---
## 题目
手写二分查找（包括查找左边界和右边界）

## 答案
## 二分查找实现

```js
// 基础版：找到目标值的任意位置
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// 查找左边界（第一个 >= target 的位置）
function lowerBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo; // lo == hi，即左边界
}

// 查找右边界（最后一个 <= target 的位置 + 1）
function upperBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// 测试
const arr = [1, 2, 2, 3, 3, 3, 4, 5];
console.log(binarySearch(arr, 3));  // 3, 4 或 5（任意）
console.log(lowerBound(arr, 3));    // 3（第一个3）
console.log(upperBound(arr, 3));    // 6（最后一个3的下一位）
console.log(lowerBound(arr, 3) === upperBound(arr, 3)); // false，说明3存在
console.log(lowerBound(arr, 6) === upperBound(arr, 6)); // true，说明6不存在
```

---
id: code-034
module: 手写题
difficulty: 2
tags: [树, DFS, BFS, 算法]
source: 高频
---
## 题目
手写树的深度优先遍历（DFS）和广度优先遍历（BFS）

## 答案
## 树的 DFS 和 BFS

```js
// 树节点
class TreeNode {
  constructor(val, children = []) {
    this.val = val;
    this.children = children;
  }
}

// DFS - 递归
function dfsRecursive(root, result = []) {
  if (!root) return result;
  result.push(root.val);
  root.children.forEach((child) => dfsRecursive(child, result));
  return result;
}

// DFS - 迭代（用栈）
function dfsIterative(root) {
  if (!root) return [];
  const stack = [root];
  const result = [];
  while (stack.length) {
    const node = stack.pop();
    result.push(node.val);
    // 反序入栈保证从左到右遍历
    [...node.children].reverse().forEach((c) => stack.push(c));
  }
  return result;
}

// BFS（层序遍历，用队列）
function bfs(root) {
  if (!root) return [];
  const queue = [root];
  const result = [];
  while (queue.length) {
    const node = queue.shift();
    result.push(node.val);
    queue.push(...node.children);
  }
  return result;
}

// 按层输出
function bfsLevel(root) {
  if (!root) return [];
  let queue = [root];
  const levels = [];
  while (queue.length) {
    levels.push(queue.map((n) => n.val));
    queue = queue.flatMap((n) => n.children);
  }
  return levels;
}

// 测试
const tree = new TreeNode(1, [
  new TreeNode(2, [new TreeNode(4), new TreeNode(5)]),
  new TreeNode(3, [new TreeNode(6)]),
]);
console.log(dfsRecursive(tree));  // [1, 2, 4, 5, 3, 6]
console.log(bfs(tree));           // [1, 2, 3, 4, 5, 6]
console.log(bfsLevel(tree));      // [[1], [2, 3], [4, 5, 6]]
```

---
id: code-035
module: 手写题
difficulty: 2
tags: [链表, 算法]
source: 高频
---
## 题目
手写链表常见操作：反转链表、检测环、合并两个有序链表

## 答案
## 链表常见操作

```js
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

// 反转链表（迭代）
function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}

// 检测环（快慢指针）
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// 找环的入口节点
function detectCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      // 重置 slow 到 head，fast 继续，相遇点即入口
      slow = head;
      while (slow !== fast) {
        slow = slow.next;
        fast = fast.next;
      }
      return slow;
    }
  }
  return null;
}

// 合并两个有序链表
function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0);
  let cur = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) {
      cur.next = l1;
      l1 = l1.next;
    } else {
      cur.next = l2;
      l2 = l2.next;
    }
    cur = cur.next;
  }
  cur.next = l1 || l2;
  return dummy.next;
}
```

---
id: code-036
module: 手写题
difficulty: 3
tags: [设计模式, 单例]
source: 高频
---
## 题目
手写单例模式（包括普通版和基于 Proxy 的版本）

## 答案
## 单例模式实现

```js
// 方式1：闭包
function createSingleton(Constructor) {
  let instance = null;
  return function (...args) {
    if (!instance) {
      instance = new Constructor(...args);
    }
    return instance;
  };
}

// 方式2：类静态属性
class Database {
  static #instance = null;

  constructor(config) {
    if (Database.#instance) return Database.#instance;
    this.config = config;
    this.connection = null;
    Database.#instance = this;
  }

  connect() {
    this.connection = `Connected to ${this.config.host}`;
    return this;
  }

  static getInstance(config) {
    if (!Database.#instance) {
      new Database(config);
    }
    return Database.#instance;
  }
}

// 方式3：Proxy 实现（透明代理）
function SingletonProxy(Constructor) {
  let instance = null;
  return new Proxy(Constructor, {
    construct(target, args) {
      if (!instance) {
        instance = new target(...args);
      }
      return instance;
    },
  });
}

// 测试
const SingletonDB = SingletonProxy(class DB {
  constructor(name) { this.name = name; }
});
const db1 = new SingletonDB('primary');
const db2 = new SingletonDB('secondary');
console.log(db1 === db2); // true
console.log(db1.name);    // 'primary'
```

---
id: code-037
module: 手写题
difficulty: 2
tags: [设计模式, 策略模式]
source: 高频
---
## 题目
手写策略模式（以表单校验为例）

## 答案
## 策略模式实现

策略模式：将算法族分别封装，使它们之间可以互相替换。消除大量 if-else。

```js
// 校验策略集合
const validators = {
  required: (val, msg = '此项必填') => (!val && val !== 0 ? msg : null),
  minLength: (min) => (val, msg) =>
    val.length < min ? (msg || `最少 ${min} 个字符`) : null,
  maxLength: (max) => (val, msg) =>
    val.length > max ? (msg || `最多 ${max} 个字符`) : null,
  email: (val, msg = '请输入有效邮箱') =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : msg,
  phone: (val, msg = '请输入有效手机号') =>
    /^1[3-9]\d{9}$/.test(val) ? null : msg,
  pattern: (regex) => (val, msg = '格式不正确') =>
    regex.test(val) ? null : msg,
};

// 校验器
class FormValidator {
  constructor() {
    this.rules = {};
  }

  addRule(field, strategyName, ...args) {
    if (!this.rules[field]) this.rules[field] = [];
    const strategy = typeof strategyName === 'function'
      ? strategyName
      : validators[strategyName];
    if (!strategy) throw new Error(`Unknown validator: ${strategyName}`);
    const fn = typeof strategy === 'function' && strategy.length > 1
      ? strategy
      : strategy(...args);
    this.rules[field].push(typeof fn === 'function' ? fn : strategy);
    return this;
  }

  validate(data) {
    const errors = {};
    for (const [field, rules] of Object.entries(this.rules)) {
      for (const rule of rules) {
        const err = rule(data[field]);
        if (err) {
          errors[field] = err;
          break; // 每个字段只报第一个错误
        }
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }
}

// 测试
const validator = new FormValidator();
validator
  .addRule('username', 'required')
  .addRule('username', validators.minLength(3))
  .addRule('email', 'required')
  .addRule('email', 'email');

console.log(validator.validate({ username: 'Al', email: 'invalid' }));
// { valid: false, errors: { username: '最少 3 个字符', email: '请输入有效邮箱' } }
```

---
id: code-038
module: 手写题
difficulty: 3
tags: [Proxy, 响应式]
source: 高频
---
## 题目
手写基于 Proxy 的响应式系统（类似 Vue3 reactivity）

## 答案
## Vue3 响应式原理实现

```js
// 依赖收集器
let activeEffect = null;

class Dep {
  constructor() {
    this.subscribers = new Set();
  }
  depend() {
    if (activeEffect) this.subscribers.add(activeEffect);
  }
  notify() {
    this.subscribers.forEach((fn) => fn());
  }
}

// effect：追踪响应式副作用
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn;
    fn();
    activeEffect = null;
  };
  effectFn();
  return effectFn;
}

// reactive：创建响应式对象
const depMap = new WeakMap();

function getDep(target, key) {
  if (!depMap.has(target)) depMap.set(target, new Map());
  const map = depMap.get(target);
  if (!map.has(key)) map.set(key, new Dep());
  return map.get(key);
}

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const dep = getDep(target, key);
      dep.depend(); // 收集依赖
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const dep = getDep(target, key);
      const result = Reflect.set(target, key, value, receiver);
      dep.notify(); // 触发更新
      return result;
    },
  });
}

// ref：包装基本类型
function ref(value) {
  const dep = new Dep();
  return {
    get value() {
      dep.depend();
      return value;
    },
    set value(newVal) {
      value = newVal;
      dep.notify();
    },
  };
}

// 测试
const state = reactive({ count: 0, name: 'Alice' });
const count = ref(0);

effect(() => {
  console.log(`count: ${state.count}, name: ${state.name}`);
});
// 立即输出: count: 0, name: Alice

state.count = 1; // 触发: count: 1, name: Alice
state.name = 'Bob'; // 触发: count: 1, name: Bob
```

---
id: code-039
module: 手写题
difficulty: 2
tags: [函数, memoize, 缓存]
source: 高频
---
## 题目
手写函数记忆化（memoize）

## 答案
## memoize 实现

```js
// 基础版（单参数，基本类型 key）
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// 支持自定义 key 函数（处理对象参数）
function memoizeAdvanced(fn, resolver) {
  const cache = new Map();
  return function (...args) {
    const key = resolver ? resolver(...args) : args[0];
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// 带 TTL（过期时间）的版本
function memoizeWithTTL(fn, ttl = 5000) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    const now = Date.now();
    if (cache.has(key)) {
      const { value, expiry } = cache.get(key);
      if (now < expiry) return value;
    }
    const value = fn.apply(this, args);
    cache.set(key, { value, expiry: now + ttl });
    return value;
  };
}

// 测试：斐波那契
const fib = memoize(function f(n) {
  if (n <= 1) return n;
  return f(n - 1) + f(n - 2);
});
console.log(fib(40)); // 快速计算，不会重复递归
```

---
id: code-040
module: 手写题
difficulty: 3
tags: [Promise, async, 调度]
source: 高频
---
## 题目
手写带优先级的任务调度器

## 答案
## 优先级任务调度器

```js
class PriorityScheduler {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    // 用多个队列模拟优先级（数字越小优先级越高）
    this.queues = { high: [], normal: [], low: [] };
  }

  add(fn, priority = 'normal') {
    return new Promise((resolve, reject) => {
      const task = { fn, resolve, reject };
      this.queues[priority]?.push(task) ?? this.queues.normal.push(task);
      this._run();
    });
  }

  _nextTask() {
    for (const key of ['high', 'normal', 'low']) {
      if (this.queues[key].length) return this.queues[key].shift();
    }
    return null;
  }

  _run() {
    while (this.running < this.concurrency) {
      const task = this._nextTask();
      if (!task) break;
      this.running++;
      Promise.resolve()
        .then(() => task.fn())
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }
}

// 测试
const scheduler = new PriorityScheduler(1);
const delay = (ms, label) => () =>
  new Promise((r) => setTimeout(() => { console.log(label); r(label); }, ms));

scheduler.add(delay(100, 'low-1'), 'low');
scheduler.add(delay(100, 'normal-1'), 'normal');
scheduler.add(delay(100, 'high-1'), 'high');
scheduler.add(delay(100, 'high-2'), 'high');
// 输出顺序：low-1（已开始）→ high-1 → high-2 → normal-1
```

---
id: code-041
module: 手写题
difficulty: 2
tags: [数组去重, 算法]
source: 高频
---
## 题目
手写数组去重的多种方式，说明各自的时间复杂度和适用场景

## 答案
## 数组去重实现

```js
const arr = [1, 2, 2, 3, '2', null, null, { a: 1 }, { a: 1 }, NaN, NaN];

// 1. Set（最简洁，O(n)，但对象引用不去重）
const unique1 = [...new Set(arr)];

// 2. filter + indexOf（O(n²)，无法去重 NaN）
const unique2 = arr.filter((item, index) => arr.indexOf(item) === index);

// 3. reduce（O(n²)，灵活）
const unique3 = arr.reduce((acc, cur) => {
  if (!acc.includes(cur)) acc.push(cur);
  return acc;
}, []);

// 4. Map（O(n)，可自定义 key 策略）
function uniqueBy(arr, keyFn = (x) => x) {
  const map = new Map();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (map.has(key)) return false;
    map.set(key, true);
    return true;
  });
}

// 5. 对象深度去重（JSON序列化，不适用含函数/循环引用的对象）
function deepUnique(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 按对象属性去重
const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 1, name: 'C' }];
console.log(uniqueBy(users, (u) => u.id));
// [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
```

---
id: code-042
module: 手写题
difficulty: 2
tags: [Promise, 超时重试]
source: 高频
---
## 题目
手写带超时和重试机制的请求函数

## 答案
## 请求超时与重试封装

```js
// 超时控制
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

// 带重试的请求
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(fetch(url, options), options.timeout || 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        // 指数退避：每次重试等待时间翻倍
        const wait = delay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

// 更通用的版本（支持自定义重试条件）
async function retry(fn, {
  retries = 3,
  delay = 1000,
  backoff = 2,
  shouldRetry = () => true,
} = {}) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries && shouldRetry(err, i)) {
        await new Promise((r) => setTimeout(r, delay * Math.pow(backoff, i)));
      }
    }
  }
  throw lastError;
}

// 使用
retry(() => fetchWithRetry('/api/data'), {
  retries: 3,
  delay: 500,
  shouldRetry: (err) => err.message.includes('Timeout'),
}).then(console.log).catch(console.error);
```

---
id: code-043
module: 手写题
difficulty: 3
tags: [迭代器, 生成器, ES6]
source: 高频
---
## 题目
手写自定义迭代器和生成器，实现 range、无限序列等

## 答案
## 迭代器与生成器

```js
// 1. 实现 range 迭代器
function range(start, end, step = 1) {
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next() {
          if (current < end) {
            const value = current;
            current += step;
            return { value, done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

for (const n of range(0, 10, 2)) {
  process.stdout.write(n + ' '); // 0 2 4 6 8
}

// 2. 生成器版 range（更简洁）
function* rangeGen(start, end, step = 1) {
  for (let i = start; i < end; i += step) yield i;
}

// 3. 无限序列生成器
function* naturals(start = 0) {
  while (true) yield start++;
}

function* take(n, iter) {
  let count = 0;
  for (const item of iter) {
    if (count++ >= n) break;
    yield item;
  }
}

console.log([...take(5, naturals(1))]); // [1, 2, 3, 4, 5]

// 4. 惰性 map/filter（用生成器）
function* lazyMap(iter, fn) {
  for (const item of iter) yield fn(item);
}

function* lazyFilter(iter, pred) {
  for (const item of iter) if (pred(item)) yield item;
}

// 处理无限序列：取前10个偶数的平方
const result = [
  ...take(10, lazyMap(lazyFilter(naturals(1), (n) => n % 2 === 0), (n) => n * n)),
];
console.log(result); // [4, 16, 36, 64, 100, 144, 196, 256, 324, 400]
```

---
id: code-044
module: 手写题
difficulty: 3
tags: [async, 串行并行, 控制流]
source: 高频
---
## 题目
用 Promise 实现 async/await（Generator + 自动执行器）

## 答案
## Generator 自动执行器（模拟 async/await）

```js
// async/await 本质是 Generator + 自动执行器
function asyncToGenerator(generatorFn) {
  return function (...args) {
    const gen = generatorFn.apply(this, args);

    return new Promise((resolve, reject) => {
      function step(key, arg) {
        let result;
        try {
          result = gen[key](arg); // 'next' 或 'throw'
        } catch (err) {
          return reject(err);
        }

        const { value, done } = result;
        if (done) {
          resolve(value);
        } else {
          // value 可能是 Promise 或普通值
          Promise.resolve(value).then(
            (val) => step('next', val),
            (err) => step('throw', err),
          );
        }
      }

      step('next', undefined);
    });
  };
}

// 测试（等价于 async function）
const fetchData = asyncToGenerator(function* () {
  const user = yield Promise.resolve({ id: 1, name: 'Alice' });
  const posts = yield Promise.resolve([{ title: 'Post 1' }, { title: 'Post 2' }]);
  return { user, posts };
});

fetchData().then(console.log);
// { user: { id: 1, name: 'Alice' }, posts: [...] }

// 对比原生 async/await
async function fetchDataNative() {
  const user = await Promise.resolve({ id: 1, name: 'Alice' });
  const posts = await Promise.resolve([{ title: 'Post 1' }]);
  return { user, posts };
}
```

---
id: code-045
module: 手写题
difficulty: 2
tags: [观察者, 双向绑定]
source: 高频
---
## 题目
手写简单的双向数据绑定（模拟 Vue2 的 Object.defineProperty 方式）

## 答案
## 双向数据绑定实现

```js
// 依赖收集 Dep
class Dep {
  constructor() { this.subs = []; }
  addSub(watcher) { this.subs.push(watcher); }
  notify() { this.subs.forEach((w) => w.update()); }
}

// 观察者 Watcher
class Watcher {
  constructor(vm, key, cb) {
    this.vm = vm;
    this.key = key;
    this.cb = cb;
    // 触发 getter 收集依赖
    Dep.target = this;
    this.oldVal = vm[key];
    Dep.target = null;
  }
  update() {
    const newVal = this.vm[this.key];
    if (newVal !== this.oldVal) {
      this.cb(newVal, this.oldVal);
      this.oldVal = newVal;
    }
  }
}

// 响应式处理
function defineReactive(obj, key, val) {
  const dep = new Dep();
  Object.defineProperty(obj, key, {
    get() {
      if (Dep.target) dep.addSub(Dep.target);
      return val;
    },
    set(newVal) {
      if (newVal === val) return;
      val = newVal;
      dep.notify();
    },
  });
}

// 简版 Vue
class SimpleVue {
  constructor({ data, el }) {
    this._data = data;
    Object.keys(data).forEach((key) => {
      defineReactive(this._data, key, data[key]);
      // 代理到 this 上（this.msg 等价于 this._data.msg）
      Object.defineProperty(this, key, {
        get: () => this._data[key],
        set: (v) => { this._data[key] = v; },
      });
    });
    this._compile(document.querySelector(el));
  }

  _compile(el) {
    el.querySelectorAll('[v-model]').forEach((node) => {
      const key = node.getAttribute('v-model');
      node.value = this[key];
      new Watcher(this, key, (val) => { node.value = val; });
      node.addEventListener('input', (e) => { this[key] = e.target.value; });
    });
    el.querySelectorAll('[v-text]').forEach((node) => {
      const key = node.getAttribute('v-text');
      node.textContent = this[key];
      new Watcher(this, key, (val) => { node.textContent = val; });
    });
  }
}
```

---
id: code-046
module: 手写题
difficulty: 2
tags: [类型判断, 工具函数]
source: 高频
---
## 题目
手写完整的类型判断工具函数（is 系列）

## 答案
## 类型判断工具函数

```js
const typeOf = (val) => Object.prototype.toString.call(val).slice(8, -1).toLowerCase();

const is = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !Number.isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
  undefined: (v) => v === undefined,
  nullish: (v) => v == null,
  symbol: (v) => typeof v === 'symbol',
  bigint: (v) => typeof v === 'bigint',
  function: (v) => typeof v === 'function',
  array: (v) => Array.isArray(v),
  object: (v) => typeOf(v) === 'object',
  plainObject: (v) => {
    if (typeOf(v) !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === null || proto === Object.prototype;
  },
  date: (v) => v instanceof Date && !isNaN(v),
  regexp: (v) => v instanceof RegExp,
  promise: (v) => v instanceof Promise || (v != null && typeof v.then === 'function'),
  map: (v) => v instanceof Map,
  set: (v) => v instanceof Set,
  error: (v) => v instanceof Error,
  integer: (v) => Number.isInteger(v),
  finite: (v) => Number.isFinite(v),
  nan: (v) => Number.isNaN(v),
  empty: (v) => {
    if (is.nullish(v)) return true;
    if (is.string(v) || is.array(v)) return v.length === 0;
    if (is.map(v) || is.set(v)) return v.size === 0;
    if (is.object(v)) return Object.keys(v).length === 0;
    return false;
  },
};

// 测试
console.log(is.plainObject({}));        // true
console.log(is.plainObject(new Date())); // false
console.log(is.promise(Promise.resolve())); // true
console.log(is.empty(new Map()));       // true
console.log(is.nan(NaN));               // true
console.log(is.number(NaN));            // false（特意排除 NaN）
```

---
id: code-047
module: 手写题
difficulty: 3
tags: [Trie, 数据结构, 算法]
source: 高频
---
## 题目
手写字典树（Trie）实现自动补全功能

## 答案
## Trie 字典树实现

```js
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEnd = false;
    this.count = 0; // 以此节点结尾的单词数
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      node = node.children.get(ch);
    }
    node.isEnd = true;
    node.count++;
  }

  search(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) return false;
      node = node.children.get(ch);
    }
    return node.isEnd;
  }

  startsWith(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return false;
      node = node.children.get(ch);
    }
    return true;
  }

  // 自动补全：返回所有以 prefix 开头的单词
  autoComplete(prefix, maxResults = 10) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch);
    }

    const results = [];
    const dfs = (n, current) => {
      if (results.length >= maxResults) return;
      if (n.isEnd) results.push(current);
      for (const [ch, child] of n.children) {
        dfs(child, current + ch);
      }
    };
    dfs(node, prefix);
    return results;
  }

  delete(word) {
    const dfs = (node, i) => {
      if (i === word.length) {
        if (!node.isEnd) return false;
        node.isEnd = false;
        node.count--;
        return node.children.size === 0;
      }
      const ch = word[i];
      const child = node.children.get(ch);
      if (!child) return false;
      if (dfs(child, i + 1)) {
        node.children.delete(ch);
        return !node.isEnd && node.children.size === 0;
      }
      return false;
    };
    dfs(this.root, 0);
  }
}

// 测试
const trie = new Trie();
['apple', 'app', 'application', 'apply', 'apt', 'banana'].forEach((w) => trie.insert(w));
console.log(trie.autoComplete('app')); // ['app', 'apple', 'application', 'apply']
console.log(trie.search('app'));       // true
console.log(trie.startsWith('apt'));   // true
```

---
id: code-048
module: 手写题
difficulty: 3
tags: [设计模式, 中间件]
source: 高频
---
## 题目
手写 Koa/Express 风格的中间件（洋葱模型）

## 答案
## 洋葱模型中间件实现

```js
// Koa compose 核心实现
function compose(middlewares) {
  return function (ctx, next) {
    let index = -1;

    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next; // 最后一个中间件之后调用 next
      if (!fn) return Promise.resolve();

      try {
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}

// 简版 Koa App
class MiniKoa {
  constructor() {
    this.middlewares = [];
  }

  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  async handleRequest(ctx) {
    const fn = compose(this.middlewares);
    await fn(ctx);
  }
}

// 测试
const app = new MiniKoa();
const ctx = { req: '/', res: null, log: [] };

app.use(async (ctx, next) => {
  ctx.log.push('M1 before');
  await next();
  ctx.log.push('M1 after');
});

app.use(async (ctx, next) => {
  ctx.log.push('M2 before');
  await next();
  ctx.log.push('M2 after');
});

app.use(async (ctx) => {
  ctx.log.push('handler');
  ctx.res = 'Hello World';
});

app.handleRequest(ctx).then(() => {
  console.log(ctx.log);
  // ['M1 before', 'M2 before', 'handler', 'M2 after', 'M1 after']
  console.log(ctx.res); // 'Hello World'
});
```

---
id: code-049
module: 手写题
difficulty: 2
tags: [Object, 工具函数, 对象]
source: 高频
---
## 题目
手写对象常见工具函数：omit、pick、merge、groupBy

## 答案
## 对象工具函数实现

```js
// pick：从对象中选取指定属性
function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {});
}

// omit：从对象中排除指定属性
function omit(obj, keys) {
  const set = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !set.has(k)),
  );
}

// 深度 merge（对象递归合并）
function merge(target, ...sources) {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = target[key];
      if (
        srcVal !== null &&
        typeof srcVal === 'object' &&
        !Array.isArray(srcVal) &&
        typeof tgtVal === 'object' &&
        tgtVal !== null
      ) {
        target[key] = merge({ ...tgtVal }, srcVal);
      } else {
        target[key] = srcVal;
      }
    }
  }
  return target;
}

// groupBy：按 key 分组
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const group = typeof key === 'function' ? key(item) : item[key];
    (acc[group] = acc[group] || []).push(item);
    return acc;
  }, {});
}

// 测试
const user = { id: 1, name: 'Alice', age: 25, password: 'xxx' };
console.log(pick(user, ['id', 'name']));        // { id: 1, name: 'Alice' }
console.log(omit(user, ['password', 'age']));   // { id: 1, name: 'Alice' }

const data = [
  { name: 'Alice', dept: 'eng' },
  { name: 'Bob', dept: 'eng' },
  { name: 'Carol', dept: 'design' },
];
console.log(groupBy(data, 'dept'));
// { eng: [{...}, {...}], design: [{...}] }

console.log(groupBy([1, 2, 3, 4, 5, 6], (n) => (n % 2 === 0 ? 'even' : 'odd')));
// { odd: [1, 3, 5], even: [2, 4, 6] }
```

---
id: code-050
module: 手写题
difficulty: 3
tags: [Promise, 并发, 请求合并]
source: 高频
---
## 题目
手写请求合并（同一时刻多个相同请求合并为一个，类似 SWR 的 deduplication）

## 答案
## 请求合并（Request Deduplication）

在 SWR / React Query 中，短时间内多次触发同一个请求会被合并成一个。

```js
class RequestDeduplicator {
  constructor() {
    // 存储正在进行的请求：key → Promise
    this.pending = new Map();
  }

  async fetch(key, fetchFn) {
    // 已有相同请求正在进行，直接复用
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = fetchFn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// 全局实例
const dedup = new RequestDeduplicator();

// 带缓存的版本（类似 SWR）
class SWRCache {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.pending = new Map();
    this.ttl = ttl;
  }

  async get(key, fetcher) {
    // 1. 命中缓存且未过期
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // 2. 正在请求中，等待复用
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // 3. 发起新请求
    const promise = fetcher()
      .then((data) => {
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
      })
      .finally(() => this.pending.delete(key));

    this.pending.set(key, promise);
    return promise;
  }

  invalidate(key) {
    this.cache.delete(key);
  }
}

// 测试
const swr = new SWRCache(3000);
const mockFetch = (id) => () =>
  new Promise((r) => setTimeout(() => r({ id, name: `User ${id}` }), 200));

// 同时发起 3 个相同请求，只会真正 fetch 一次
Promise.all([
  swr.get('user:1', mockFetch(1)),
  swr.get('user:1', mockFetch(1)),
  swr.get('user:1', mockFetch(1)),
]).then((results) => {
  console.log(results); // 三个结果相同，只发了一次请求
  // 3秒内再次获取，命中缓存
  return swr.get('user:1', mockFetch(1));
}).then(console.log);
```

```

Now generate the project.md file:
