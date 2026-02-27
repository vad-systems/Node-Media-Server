"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAMF3Context = createAMF3Context;
exports.createAMF0Context = createAMF0Context;
exports.decodeAmf3Cmd = decodeAMF3Cmd;
exports.encodeAmf3Cmd = encodeAMF3Cmd;
exports.decodeAmf0Cmd = decodeAMF0Cmd;
exports.encodeAmf0Cmd = encodeAMF0Cmd;
exports.decodeAmf0Data = decodeAmf0Data;
exports.encodeAmf0Data = encodeAMF0Data;
exports.amfType = amfType;
exports.amf0Encode = amf0Encode;
exports.amf0EncodeOne = amf0EncodeOne;
exports.amf0Decode = amf0Decode;
exports.amf0DecodeOne = amf0DecodeOne;
exports.amf3Encode = amf3Encode;
exports.amf3EncodeOne = amf3EncodeOne;
exports.amf3Decode = amf3Decode;
exports.amf3DecodeOne = amf3DecodeOne;
exports.amf0cnvA2O = amf0cnletray2Object;
exports.amf0cnvO2A = amf0cnvObject2Array;
exports.amf0markSArray = amf0markSArray;
exports.amf0decArray = amf0decArray;
exports.amf0decBool = amf0decBool;
exports.amf0decDate = amf0decDate;
exports.amf0decLongString = amf0decLongString;
exports.amf0decNull = amf0decNull;
exports.amf0decNumber = amf0decNumber;
exports.amf0decObject = amf0decObject;
exports.amf0decRef = amf0decRef;
exports.amf0decSArray = amf0decSArray;
exports.amf0decString = amf0decString;
exports.amf0decTypedObj = amf0decTypedObj;
exports.amf0decUndefined = amf0decUndefined;
exports.amf0decXmlDoc = amf0decXmlDoc;
exports.amf0encArray = amf0encArray;
exports.amf0encBool = amf0encBool;
exports.amf0encDate = amf0encDate;
exports.amf0encLongString = amf0encLongString;
exports.amf0encNull = amf0encNull;
exports.amf0encNumber = amf0encNumber;
exports.amf0encObject = amf0encObject;
exports.amf0encRef = amf0encRef;
exports.amf0encSArray = amf0encSArray;
exports.amf0encString = amf0encString;
exports.amf0encTypedObj = amf0encTypedObj;
exports.amf0encUndefined = amf0encUndefined;
exports.amf0encXmlDoc = amf0encXmlDoc;
exports.amf3decArray = amf3decArray;
exports.amf3decByteArray = amf3decByteArray;
exports.amf3decDate = amf3decDate;
exports.amf3decDouble = amf3decDouble;
exports.amf3decFalse = amf3decFalse;
exports.amf3decInteger = amf3decInteger;
exports.amf3decNull = amf3decNull;
exports.amf3decObject = amf3decObject;
exports.amf3decString = amf3decString;
exports.amf3decTrue = amf3decTrue;
exports.amf3decUI29 = amf3decUI29;
exports.amf3decUndefined = amf3decUndefined;
exports.amf3decXml = amf3decXml;
exports.amf3decXmlDoc = amf3decXmlDoc;
exports.amf3encArray = amf3encArray;
exports.amf3encByteArray = amf3encByteArray;
exports.amf3encDate = amf3encDate;
exports.amf3encDouble = amf3encDouble;
exports.amf3encFalse = amf3encFalse;
exports.amf3encInteger = amf3encInteger;
exports.amf3encNull = amf3encNull;
exports.amf3encObject = amf3encObject;
exports.amf3encString = amf3encString;
exports.amf3encTrue = amf3encTrue;
exports.amf3encUI29 = amf3encUI29;
exports.amf3encUndefined = amf3encUndefined;
exports.amf3encXml = amf3encXml;
exports.amf3encXmlDoc = amf3encXmlDoc;
const logger_js_1 = require("../logger.js");
function createAMF3Context() {
    return {
        strings: [],
        objects: [],
        traits: []
    };
}
function createAMF0Context() {
    return {
        objects: []
    };
}
const amf3dRules = {
    0x00: amf3decUndefined,
    0x01: amf3decNull,
    0x02: amf3decFalse,
    0x03: amf3decTrue,
    0x04: amf3decInteger,
    0x05: amf3decDouble,
    0x06: amf3decString,
    0x07: amf3decXmlDoc,
    0x08: amf3decDate,
    0x09: amf3decArray,
    0x0A: amf3decObject,
    0x0B: amf3decXml,
    0x0C: amf3decByteArray
};
const amf3eRules = {
    'string': amf3encString,
    'integer': amf3encInteger,
    'double': amf3encDouble,
    'xml': amf3encXmlDoc,
    'object': amf3encObject,
    'typed_object': amf3encObject,
    'array': amf3encArray,
    'sarray': amf3encArray,
    'binary': amf3encByteArray,
    'true': amf3encTrue,
    'false': amf3encFalse,
    'undefined': amf3encUndefined,
    'null': amf3encNull
};
const amf0dRules = {
    0x00: amf0decNumber,
    0x01: amf0decBool,
    0x02: amf0decString,
    0x03: amf0decObject,
    0x05: amf0decNull,
    0x06: amf0decUndefined,
    0x07: amf0decRef,
    0x08: amf0decArray,
    0x0A: amf0decSArray,
    0x0B: amf0decDate,
    0x0C: amf0decLongString,
    0x0F: amf0decXmlDoc,
    0x10: amf0decTypedObj,
    0x11: amf0decSwitchAmf3
};
const amf0eRules = {
    'string': amf0encString,
    'integer': amf0encNumber,
    'double': amf0encNumber,
    'xml': amf0encXmlDoc,
    'object': amf0encObject,
    'typed_object': amf0encTypedObj,
    'array': amf0encArray,
    'sarray': amf0encSArray,
    'binary': amf0encString,
    'true': amf0encBool,
    'false': amf0encBool,
    'undefined': amf0encUndefined,
    'null': amf0encNull
};
function amfType(o) {
    let jsType = typeof o;
    if (o === null)
        return 'null';
    if (jsType == 'undefined')
        return 'undefined';
    if (jsType == 'number') {
        if (parseInt(o) == o)
            return 'integer';
        return 'double';
    }
    if (jsType == 'boolean')
        return o ? 'true' : 'false';
    if (jsType == 'string')
        return 'string';
    if (jsType == 'object') {
        if (o instanceof Array) {
            if (o.sarray)
                return 'sarray';
            return 'array';
        }
        if (o.__className__)
            return 'typed_object';
        return 'object';
    }
    throw new Error('Unsupported type!');
}
// AMF3 implementation
function amf3decUndefined() {
    return { len: 1, value: undefined };
}
function amf3encUndefined() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x00);
    return buf;
}
function amf3decNull() {
    return { len: 1, value: null };
}
function amf3encNull() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x01);
    return buf;
}
function amf3decFalse() {
    return { len: 1, value: false };
}
function amf3encFalse() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x02);
    return buf;
}
function amf3decTrue() {
    return { len: 1, value: true };
}
function amf3encTrue() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x03);
    return buf;
}
function amf3decUI29(buf) {
    let val = 0;
    let b = buf.readUInt8(0);
    if (b < 0x80) {
        return { len: 1, value: b };
    }
    val = (b & 0x7f) << 7;
    b = buf.readUInt8(1);
    if (b < 0x80) {
        return { len: 2, value: val | b };
    }
    val = (val | (b & 0x7f)) << 7;
    b = buf.readUInt8(2);
    if (b < 0x80) {
        return { len: 3, value: val | b };
    }
    val = (val | (b & 0x7f)) << 8;
    b = buf.readUInt8(3);
    return { len: 4, value: val | b };
}
function amf3encUI29(num) {
    if (num < 0)
        num = 0;
    if (num < 0x80) {
        return Buffer.from([num]);
    }
    else if (num < 0x4000) {
        return Buffer.from([(num >> 7) | 0x80, num & 0x7F]);
    }
    else if (num < 0x200000) {
        return Buffer.from([(num >> 14) | 0x80, (num >> 7) | 0x80, num & 0x7F]);
    }
    else if (num < 0x40000000) {
        return Buffer.from([(num >> 22) | 0x80, (num >> 15) | 0x80, (num >> 8) | 0x80, num & 0xFF]);
    }
    else {
        throw new Error('UI29 out of range');
    }
}
function amf3decInteger(buf) {
    let ret = amf3decUI29(buf.slice(1));
    let resp = { len: ret.len + 1, value: ret.value };
    if (resp.value > 0x0FFFFFFF)
        resp.value = (resp.value & 0x0FFFFFFF) - 0x10000000;
    return resp;
}
function amf3encInteger(num) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x4, 0);
    return Buffer.concat([buf, amf3encUI29(num & 0x3FFFFFFF)]);
}
function amf3decString(buf, ctx = createAMF3Context()) {
    let res = amf3decUString(buf.slice(1), ctx);
    return { len: res.len + 1, value: res.value };
}
function amf3decUString(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf);
    let isRef = (sLen.value & 1) === 0;
    let val = sLen.value >> 1;
    if (isRef) {
        return { len: sLen.len, value: ctx.strings[val] };
    }
    else {
        if (val === 0) {
            return { len: sLen.len, value: "" };
        }
        let str = buf.slice(sLen.len, sLen.len + val).toString('utf8');
        ctx.strings.push(str);
        return { len: val + sLen.len, value: str };
    }
}
function amf3encString(str, ctx = createAMF3Context()) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x06, 0);
    return Buffer.concat([buf, amf3encUString(str, ctx)]);
}
function amf3encUString(str, ctx = createAMF3Context()) {
    if (str === "") {
        return amf3encUI29(1);
    }
    let idx = ctx.strings.indexOf(str);
    if (idx !== -1) {
        return amf3encUI29(idx << 1);
    }
    ctx.strings.push(str);
    let strBuf = Buffer.from(str, 'utf8');
    let sLen = amf3encUI29((strBuf.length << 1) | 1);
    return Buffer.concat([sLen, strBuf]);
}
function amf3decXmlDoc(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf.slice(1));
    let isRef = (sLen.value & 1) === 0;
    let val = sLen.value >> 1;
    if (isRef) {
        return { len: sLen.len + 1, value: ctx.objects[val] };
    }
    else {
        let str = buf.slice(sLen.len + 1, sLen.len + val + 1).toString('utf8');
        ctx.objects.push(str);
        return { len: val + sLen.len + 1, value: str };
    }
}
function amf3encXmlDoc(str, ctx = createAMF3Context()) {
    let strBuf = Buffer.from(str, 'utf8');
    let sLen = amf3encUI29((strBuf.length << 1) | 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x07, 0);
    return Buffer.concat([buf, sLen, strBuf]);
}
function amf3decXml(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf.slice(1));
    let isRef = (sLen.value & 1) === 0;
    let val = sLen.value >> 1;
    if (isRef) {
        return { len: sLen.len + 1, value: ctx.objects[val] };
    }
    else {
        let str = buf.slice(sLen.len + 1, sLen.len + val + 1).toString('utf8');
        ctx.objects.push(str);
        return { len: val + sLen.len + 1, value: str };
    }
}
function amf3encXml(str, ctx = createAMF3Context()) {
    let strBuf = Buffer.from(str, 'utf8');
    let sLen = amf3encUI29((strBuf.length << 1) | 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x0B, 0);
    return Buffer.concat([buf, sLen, strBuf]);
}
function amf3decByteArray(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf.slice(1));
    let isRef = (sLen.value & 1) === 0;
    let val = sLen.value >> 1;
    if (isRef) {
        return { len: sLen.len + 1, value: ctx.objects[val] };
    }
    else {
        let data = buf.slice(sLen.len + 1, sLen.len + val + 1);
        ctx.objects.push(data);
        return { len: val + sLen.len + 1, value: data };
    }
}
function amf3encByteArray(str, ctx = createAMF3Context()) {
    let data = (typeof str == 'string') ? Buffer.from(str, 'binary') : str;
    let sLen = amf3encUI29((data.length << 1) | 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x0C, 0);
    return Buffer.concat([buf, sLen, data]);
}
function amf3decDouble(buf) {
    return { len: 9, value: buf.readDoubleBE(1) };
}
function amf3encDouble(num) {
    let buf = Buffer.alloc(9);
    buf.writeUInt8(0x05, 0);
    buf.writeDoubleBE(num, 1);
    return buf;
}
function amf3decDate(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf.slice(1));
    let isRef = (sLen.value & 1) === 0;
    if (isRef) {
        return { len: sLen.len + 1, value: ctx.objects[sLen.value >> 1] };
    }
    let ts = buf.readDoubleBE(sLen.len + 1);
    let date = new Date(ts);
    ctx.objects.push(date);
    return { len: sLen.len + 9, value: date };
}
function amf3encDate(ts, ctx = createAMF3Context()) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x08, 0);
    let tsBuf = Buffer.alloc(8);
    tsBuf.writeDoubleBE(ts, 0);
    return Buffer.concat([buf, amf3encUI29(1), tsBuf]);
}
function amf3decArray(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf.slice(1));
    let isRef = (sLen.value & 1) === 0;
    let count = sLen.value >> 1;
    if (isRef) {
        return { len: sLen.len + 1, value: ctx.objects[count] };
    }
    let arr = [];
    ctx.objects.push(arr);
    let len = sLen.len + 1;
    // Associative part
    while (true) {
        let key = amf3decUString(buf.slice(len), ctx);
        len += key.len;
        if (key.value === "")
            break;
        let val = amf3DecodeOne(buf.slice(len), ctx);
        len += val.len;
        arr[key.value] = val.value;
    }
    // Dense part
    for (let i = 0; i < count; i++) {
        let val = amf3DecodeOne(buf.slice(len), ctx);
        len += val.len;
        arr.push(val.value);
    }
    return { len, value: arr };
}
function amf3encArray(a, ctx = createAMF3Context()) {
    let idx = ctx.objects.indexOf(a);
    if (idx !== -1) {
        return Buffer.concat([Buffer.from([0x09]), amf3encUI29(idx << 1)]);
    }
    ctx.objects.push(a);
    let buf = Buffer.from([0x09]);
    let sLen = amf3encUI29((a.length << 1) | 1);
    buf = Buffer.concat([buf, sLen]);
    // Associative part
    for (let key in a) {
        if (isNaN(parseInt(key))) {
            buf = Buffer.concat([buf, amf3encUString(key, ctx), amf3EncodeOne(a[key], ctx)]);
        }
    }
    buf = Buffer.concat([buf, amf3encUString("", ctx)]);
    // Dense part
    for (let i = 0; i < a.length; i++) {
        buf = Buffer.concat([buf, amf3EncodeOne(a[i], ctx)]);
    }
    return buf;
}
function amf3decObject(buf, ctx = createAMF3Context()) {
    let sLen = amf3decUI29(buf.slice(1));
    let isRef = (sLen.value & 1) === 0;
    if (isRef) {
        return { len: sLen.len + 1, value: ctx.objects[sLen.value >> 1] };
    }
    let isTraitsRef = (sLen.value & 2) === 0;
    let traits;
    let len = sLen.len + 1;
    if (isTraitsRef) {
        traits = ctx.traits[sLen.value >> 2];
    }
    else {
        traits = {
            externalizable: (sLen.value & 4) !== 0,
            dynamic: (sLen.value & 8) !== 0,
            count: sLen.value >> 4,
            className: null,
            properties: []
        };
        let clsName = amf3decUString(buf.slice(len), ctx);
        traits.className = clsName.value;
        len += clsName.len;
        for (let i = 0; i < traits.count; i++) {
            let propName = amf3decUString(buf.slice(len), ctx);
            traits.properties.push(propName.value);
            len += propName.len;
        }
        ctx.traits.push(traits);
    }
    let obj = {};
    ctx.objects.push(obj);
    if (traits.className)
        obj.__className__ = traits.className;
    if (traits.externalizable) {
        throw new Error("Externalizable traits not supported yet");
    }
    for (let i = 0; i < traits.count; i++) {
        let val = amf3DecodeOne(buf.slice(len), ctx);
        obj[traits.properties[i]] = val.value;
        len += val.len;
    }
    if (traits.dynamic) {
        while (true) {
            let key = amf3decUString(buf.slice(len), ctx);
            len += key.len;
            if (key.value === "")
                break;
            let val = amf3DecodeOne(buf.slice(len), ctx);
            obj[key.value] = val.value;
            len += val.len;
        }
    }
    return { len, value: obj };
}
function amf3encObject(o, ctx = createAMF3Context()) {
    let idx = ctx.objects.indexOf(o);
    if (idx !== -1) {
        return Buffer.concat([Buffer.from([0x0A]), amf3encUI29(idx << 1)]);
    }
    ctx.objects.push(o);
    let className = o.__className__ || "";
    // Simplified: always dynamic with no static properties
    let buf = Buffer.from([0x0A, 0x0B]); // 0x0B = new traits, not externalizable, dynamic, 0 static props.
    buf = Buffer.concat([buf, amf3encUString(className, ctx)]);
    for (let key in o) {
        if (key === '__className__')
            continue;
        buf = Buffer.concat([buf, amf3encUString(key, ctx), amf3EncodeOne(o[key], ctx)]);
    }
    buf = Buffer.concat([buf, amf3encUString("", ctx)]);
    return buf;
}
// AMF0 Implementation
function amf0decNumber(buf) {
    return { len: 9, value: buf.readDoubleBE(1) };
}
function amf0encNumber(num) {
    let buf = Buffer.alloc(9);
    buf.writeUInt8(0x00, 0);
    buf.writeDoubleBE(num, 1);
    return buf;
}
function amf0decBool(buf) {
    return { len: 2, value: (buf.readUInt8(1) != 0) };
}
function amf0encBool(num) {
    let buf = Buffer.alloc(2);
    buf.writeUInt8(0x01, 0);
    buf.writeUInt8((num ? 1 : 0), 1);
    return buf;
}
function amf0decNull() {
    return { len: 1, value: null };
}
function amf0encNull() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x05, 0);
    return buf;
}
function amf0decUndefined() {
    return { len: 1, value: undefined };
}
function amf0encUndefined() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x06, 0);
    return buf;
}
function amf0decDate(buf) {
    let ts = buf.readDoubleBE(3);
    return { len: 11, value: ts };
}
function amf0encDate(ts) {
    let buf = Buffer.alloc(11);
    buf.writeUInt8(0x0B, 0);
    buf.writeInt16BE(0, 1);
    buf.writeDoubleBE(ts, 3);
    return buf;
}
function amf0decObject(buf, ctx = createAMF0Context()) {
    let obj = {};
    ctx.objects.push(obj);
    let iBuf = buf.slice(1);
    let len = 1;
    while (iBuf.readUInt8(0) != 0x09) {
        let prop = amf0decUString(iBuf);
        len += prop.len;
        if (iBuf.length <= prop.len) {
            break;
        }
        if (iBuf.slice(prop.len).readUInt8(0) == 0x09) {
            len++;
            break;
        }
        if (prop.value == '')
            break;
        let val = amf0DecodeOne(iBuf.slice(prop.len), ctx);
        obj[prop.value] = val.value;
        len += val.len;
        iBuf = iBuf.slice(prop.len + val.len);
    }
    return { len: len, value: obj };
}
function amf0encObject(o, ctx = createAMF0Context()) {
    if (typeof o !== 'object')
        return Buffer.alloc(0);
    let idx = ctx.objects.indexOf(o);
    if (idx !== -1) {
        return amf0encRef(idx);
    }
    ctx.objects.push(o);
    let data = Buffer.alloc(1);
    data.writeUInt8(0x03, 0);
    return Buffer.concat([data, amf0encUObject(o, ctx)]);
}
function amf0encUObject(o, ctx) {
    let data = Buffer.alloc(0);
    let k;
    for (k in o) {
        if (k === '__className__')
            continue;
        data = Buffer.concat([data, amf0encUString(k), amf0EncodeOne(o[k], ctx)]);
    }
    let termCode = Buffer.alloc(1);
    termCode.writeUInt8(0x09, 0);
    return Buffer.concat([data, amf0encUString(''), termCode]);
}
function amf0encTypedObj(o, ctx = createAMF0Context()) {
    let idx = ctx.objects.indexOf(o);
    if (idx !== -1) {
        return amf0encRef(idx);
    }
    ctx.objects.push(o);
    let data = Buffer.alloc(1);
    data.writeUInt8(0x10, 0); // Type Typed Object
    data = Buffer.concat([data, amf0encUString(o.__className__), amf0encUObject(o, ctx)]);
    return data;
}
function amf0decRef(buf, ctx = createAMF0Context()) {
    let index = buf.readUInt16BE(1);
    return { len: 3, value: ctx.objects[index] };
}
function amf0encRef(index) {
    let buf = Buffer.alloc(3);
    buf.writeUInt8(0x07, 0);
    buf.writeUInt16BE(index, 1);
    return buf;
}
function amf0decString(buf) {
    let sLen = buf.readUInt16BE(1);
    return { len: 3 + sLen, value: buf.toString('utf8', 3, 3 + sLen) };
}
function amf0decUString(buf) {
    let sLen = buf.readUInt16BE(0);
    return { len: 2 + sLen, value: buf.toString('utf8', 2, 2 + sLen) };
}
function amf0encUString(str) {
    let data = Buffer.from(str, 'utf8');
    let sLen = Buffer.alloc(2);
    sLen.writeUInt16BE(data.length, 0);
    return Buffer.concat([sLen, data]);
}
function amf0encString(str) {
    let strBuf = Buffer.from(str, 'utf8');
    let buf = Buffer.alloc(3);
    buf.writeUInt8(0x02, 0);
    buf.writeUInt16BE(strBuf.length, 1);
    return Buffer.concat([buf, strBuf]);
}
function amf0decLongString(buf) {
    let sLen = buf.readUInt32BE(1);
    return { len: 5 + sLen, value: buf.toString('utf8', 5, 5 + sLen) };
}
function amf0encLongString(str) {
    let strBuf = Buffer.from(str, 'utf8');
    let buf = Buffer.alloc(5);
    buf.writeUInt8(0x0C, 0);
    buf.writeUInt32BE(strBuf.length, 1);
    return Buffer.concat([buf, strBuf]);
}
function amf0decArray(buf, ctx = createAMF0Context()) {
    let obj = amf0decObject(buf.slice(4), ctx);
    return { len: 4 + obj.len, value: obj.value };
}
function amf0encArray(a, ctx = createAMF0Context()) {
    let idx = ctx.objects.indexOf(a);
    if (idx !== -1) {
        return amf0encRef(idx);
    }
    ctx.objects.push(a);
    let l = 0;
    if (a instanceof Array)
        l = a.length;
    else
        l = Object.keys(a).length;
    logger_js_1.Logger.debug('Array encode', l, a);
    let buf = Buffer.alloc(5);
    buf.writeUInt8(8, 0);
    buf.writeUInt32BE(l, 1);
    return Buffer.concat([buf, amf0encUObject(a, ctx)]);
}
function amf0cnletray2Object(aData) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x3, 0);
    return Buffer.concat([buf, aData.slice(5)]);
}
function amf0cnvObject2Array(oData) {
    let buf = Buffer.alloc(5);
    buf.writeUInt8(0x08, 0);
    let o = amf0decObject(oData, createAMF0Context());
    let l = Object.keys(o.value).length;
    buf.writeUInt32BE(l, 1);
    return Buffer.concat([buf, oData.slice(1)]);
}
function amf0decXmlDoc(buf) {
    let sLen = buf.readUInt16BE(1);
    return { len: 3 + sLen, value: buf.toString('utf8', 3, 3 + sLen) };
}
function amf0encXmlDoc(str) {
    let strBuf = Buffer.from(str, 'utf8');
    let buf = Buffer.alloc(3);
    buf.writeUInt8(0x0F, 0);
    buf.writeUInt16BE(strBuf.length, 1);
    return Buffer.concat([buf, strBuf]);
}
function amf0decSArray(buf, ctx = createAMF0Context()) {
    let a = [];
    ctx.objects.push(a);
    let len = 5;
    let ret;
    for (let count = buf.readUInt32BE(1); count; count--) {
        ret = amf0DecodeOne(buf.slice(len), ctx);
        a.push(ret.value);
        len += ret.len;
    }
    return { len: len, value: amf0markSArray(a) };
}
function amf0encSArray(a, ctx = createAMF0Context()) {
    let idx = ctx.objects.indexOf(a);
    if (idx !== -1) {
        return amf0encRef(idx);
    }
    ctx.objects.push(a);
    logger_js_1.Logger.debug('Do strict array!');
    let buf = Buffer.alloc(5);
    buf.writeUInt8(0x0A, 0);
    buf.writeUInt32BE(a.length, 1);
    let i;
    for (i = 0; i < a.length; i++) {
        buf = Buffer.concat([buf, amf0EncodeOne(a[i], ctx)]);
    }
    return buf;
}
function amf0markSArray(a) {
    Object.defineProperty(a, 'sarray', { value: true });
    return a;
}
function amf0decTypedObj(buf, ctx = createAMF0Context()) {
    let className = amf0decString(buf);
    let obj = amf0decObject(buf.slice(className.len - 1), ctx);
    obj.value.__className__ = className.value;
    return { len: className.len + obj.len - 1, value: obj.value };
}
function amf0decSwitchAmf3(buf) {
    let r = amf3DecodeOne(buf.slice(1), createAMF3Context());
    return r;
}
function amfXDecodeOne(rules, buffer, ctx) {
    if (!rules[buffer.readUInt8(0)]) {
        logger_js_1.Logger.error('Unknown field', buffer.readUInt8(0));
        return null;
    }
    return rules[buffer.readUInt8(0)](buffer, ctx);
}
function amf0DecodeOne(buffer, ctx = createAMF0Context()) {
    return amfXDecodeOne(amf0dRules, buffer, ctx);
}
function amf3DecodeOne(buffer, ctx = createAMF3Context()) {
    return amfXDecodeOne(amf3dRules, buffer, ctx);
}
function amfXDecode(rules, buffer, ctx) {
    let resp = [];
    let res;
    for (let i = 0; i < buffer.length;) {
        res = amfXDecodeOne(rules, buffer.slice(i), ctx);
        i += res.len;
        resp.push(res.value);
    }
    return resp;
}
function amf3Decode(buffer) {
    return amfXDecode(amf3dRules, buffer, createAMF3Context());
}
function amf0Decode(buffer) {
    return amfXDecode(amf0dRules, buffer, createAMF0Context());
}
function amfXEncodeOne(rules, o, ctx) {
    let f = rules[amfType(o)];
    if (f)
        return f(o, ctx);
    throw new Error('Unsupported type for encoding!');
}
function amf0EncodeOne(o, ctx = createAMF0Context()) {
    return amfXEncodeOne(amf0eRules, o, ctx);
}
function amf3EncodeOne(o, ctx = createAMF3Context()) {
    return amfXEncodeOne(amf3eRules, o, ctx);
}
function amf3Encode(a) {
    let ctx = createAMF3Context();
    let buf = Buffer.alloc(0);
    a.forEach(function (o) {
        buf = Buffer.concat([buf, amf3EncodeOne(o, ctx)]);
    });
    return buf;
}
function amf0Encode(a) {
    let ctx = createAMF0Context();
    let buf = Buffer.alloc(0);
    a.forEach(function (o) {
        buf = Buffer.concat([buf, amf0EncodeOne(o, ctx)]);
    });
    return buf;
}
const rtmpCmdCode = {
    '_result': ['transId', 'cmdObj', 'info'],
    '_error': ['transId', 'cmdObj', 'info', 'streamId'],
    'onStatus': ['transId', 'cmdObj', 'info'],
    'releaseStream': ['transId', 'cmdObj', 'streamName'],
    'getStreamLength': ['transId', 'cmdObj', 'streamId'],
    'getMovLen': ['transId', 'cmdObj', 'streamId'],
    'FCPublish': ['transId', 'cmdObj', 'streamName'],
    'FCUnpublish': ['transId', 'cmdObj', 'streamName'],
    'FCSubscribe': ['transId', 'cmdObj', 'streamName'],
    'onFCPublish': ['transId', 'cmdObj', 'info'],
    'connect': ['transId', 'cmdObj', 'args'],
    'call': ['transId', 'cmdObj', 'args'],
    'createStream': ['transId', 'cmdObj'],
    'close': ['transId', 'cmdObj'],
    'play': ['transId', 'cmdObj', 'streamName', 'start', 'duration', 'reset'],
    'play2': ['transId', 'cmdObj', 'params'],
    'deleteStream': ['transId', 'cmdObj', 'streamId'],
    'closeStream': ['transId', 'cmdObj'],
    'receiveAudio': ['transId', 'cmdObj', 'bool'],
    'receiveVideo': ['transId', 'cmdObj', 'bool'],
    'publish': ['transId', 'cmdObj', 'streamName', 'type'],
    'seek': ['transId', 'cmdObj', 'ms'],
    'pause': ['transId', 'cmdObj', 'pause', 'ms']
};
const rtmpDataCode = {
    '@setDataFrame': ['method', 'dataObj'],
    'onFI': ['info'],
    'onMetaData': ['dataObj'],
    '|RtmpSampleAccess': ['bool1', 'bool2'],
};
function decodeAmf0Data(dbuf) {
    let buffer = dbuf;
    let resp = {};
    let ctx = createAMF0Context();
    let cmd = amf0DecodeOne(buffer, ctx);
    if (cmd) {
        resp.cmd = cmd.value;
        buffer = buffer.slice(cmd.len);
        if (rtmpDataCode[cmd.value]) {
            rtmpDataCode[cmd.value].forEach(function (n) {
                if (buffer.length > 0) {
                    let r = amf0DecodeOne(buffer, ctx);
                    if (r) {
                        buffer = buffer.slice(r.len);
                        resp[n] = r.value;
                    }
                }
            });
        }
        else {
            logger_js_1.Logger.error('Unknown command', resp);
        }
    }
    return resp;
}
function decodeAMF0Cmd(dbuf) {
    let buffer = dbuf;
    let resp = {};
    let ctx = createAMF0Context();
    let cmd = amf0DecodeOne(buffer, ctx);
    resp.cmd = cmd.value;
    buffer = buffer.slice(cmd.len);
    if (rtmpCmdCode[cmd.value]) {
        rtmpCmdCode[cmd.value].forEach(function (n) {
            if (buffer.length > 0) {
                let r = amf0DecodeOne(buffer, ctx);
                buffer = buffer.slice(r.len);
                resp[n] = r.value;
            }
        });
    }
    else {
        logger_js_1.Logger.error('Unknown command', resp);
    }
    return resp;
}
function encodeAMF0Cmd(opt) {
    let ctx = createAMF0Context();
    let data = amf0EncodeOne(opt.cmd, ctx);
    if (rtmpCmdCode[opt.cmd]) {
        rtmpCmdCode[opt.cmd].forEach(function (n) {
            if (opt.hasOwnProperty(n))
                data = Buffer.concat([data, amf0EncodeOne(opt[n], ctx)]);
        });
    }
    else {
        logger_js_1.Logger.error('Unknown command', opt);
    }
    return data;
}
function encodeAMF0Data(opt) {
    let ctx = createAMF0Context();
    let data = amf0EncodeOne(opt.cmd, ctx);
    if (rtmpDataCode[opt.cmd]) {
        rtmpDataCode[opt.cmd].forEach(function (n) {
            if (opt.hasOwnProperty(n))
                data = Buffer.concat([data, amf0EncodeOne(opt[n], ctx)]);
        });
    }
    else {
        logger_js_1.Logger.error('Unknown data', opt);
    }
    return data;
}
function decodeAMF3Cmd(dbuf) {
    let buffer = dbuf;
    let resp = {};
    let ctx = createAMF3Context();
    let cmd = amf3DecodeOne(buffer, ctx);
    resp.cmd = cmd.value;
    buffer = buffer.slice(cmd.len);
    if (rtmpCmdCode[cmd.value]) {
        rtmpCmdCode[cmd.value].forEach(function (n) {
            if (buffer.length > 0) {
                let r = amf3DecodeOne(buffer, ctx);
                buffer = buffer.slice(r.len);
                resp[n] = r.value;
            }
        });
    }
    else {
        logger_js_1.Logger.error('Unknown command', resp);
    }
    return resp;
}
function encodeAMF3Cmd(opt) {
    let ctx = createAMF3Context();
    let data = amf3EncodeOne(opt.cmd, ctx);
    if (rtmpCmdCode[opt.cmd]) {
        rtmpCmdCode[opt.cmd].forEach(function (n) {
            if (opt.hasOwnProperty(n))
                data = Buffer.concat([data, amf3EncodeOne(opt[n], ctx)]);
        });
    }
    else {
        logger_js_1.Logger.error('Unknown command', opt);
    }
    return data;
}
