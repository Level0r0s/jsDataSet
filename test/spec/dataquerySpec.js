'use strict';
/*globals beforeEach,jsDataSet,afterEach,describe,jasmine,it,expect,inject */
var  dsSpace = jsDataSet,
    $q = dsSpace.dataQuery;

describe('DataQuery functions', function () {
  var ds;
  function fieldGet(field){
    return function (obj){
      return obj[field];
    };
  }


  beforeEach(function () {
    ds = new dsSpace.DataSet('temp');
  });

  afterEach(function () {
    ds = null;
  });

  describe  ('EVAL requirements', function (){

    it('eval should access local variable and return something', function(){
      var ctx = {a: 1, b: 2, c: {somedata: 3}},
        res = eval('ctx.c.somedata');
      expect(res).toBe(3);
    });

    it('eval should access local variable and return something', function () {
      var ctx = {a: 1, b: 2, c: {somedata: 3}},
        res = eval('ctx.c.somedata');
      expect(res).toBe(3);
    });

    it('eval should be able to call functions', function () {
      var ctx = {a: 1, b: 2, c: {somedata: 3}, d:function(x){return x*3;}},
        res = eval('ctx.d(10)');
      expect(res).toBe(30);
    });

    it('functions called by eval have access to parent scope', function () {
      var scopeVar=100,
         ctx = {a: 1, b: 2, c: {somedata: 3}, d: function (x) {
          return x * scopeVar;
        }},
        res = eval('ctx.d(10)');
      expect(res).toBe(1000);
    });
  });

  describe('ctx function', function () {
    it ('simple fields should be correctly evaluated', function (){
      var env = {a:1, b:2},
        js = fieldGet('a'),
        ctxFun = $q.context(js);
      expect(ctxFun(env)).toBe(1);
      env.a = 10;
      expect(ctxFun(env)).toBe(10);
    });

    it('array elements should be correctly evaluated', function () {
      var env = {a: 1, b: 2, c:['a','b','c']},
        js = function(env) { return env.c[1];},
        ctxFun = $q.context(js);
      expect(ctxFun(env)).toBe('b');
      env.c[1]='q';
      expect(ctxFun(env)).toBe('q');
    });

    it('field objects should be correctly evaluated', function () {
      var env = {a: 1, b: 2, c: {a:'AA',b:'BB'}},
        js = function (env){return env.c.b;},
        ctxFun = $q.context(js);
      expect(ctxFun(env)).toBe('BB');
      env.c.b = 'q';
      expect(ctxFun(env)).toBe('q');
    });

  });

  describe('Comparison functions', function () {

    it('$q.eq should be a function', function () {
      expect($q.eq).toEqual(jasmine.any(Function));
    });

    it('$q.eq should return a function', function () {
      var x = 1,
        y = 1,
        f = $q.eq(x, y);
      expect(f).toEqual(jasmine.any(Function));
    });


    it('$q.eq between equal constants should return true', function () {
      var x = 1,
        y = 1,
        f = $q.eq(x, y);
      expect(f({})).toBeTruthy();
      x=2;
      y=3;
      expect(f({})).toBeTruthy();
    });

    it('$q.eq between different constants should return false', function () {
      var x = 1,
        y = 2,
        f = $q.eq(x, y);
      expect(f({})).toBeFalsy();
      x=2;
      expect(f({})).toBeFalsy();
      y=1;
      expect(f({})).toBeFalsy();
      x=1;
      expect(f({})).toBeFalsy();
    });
    it('comparing values with $q.eq between type does matter (1 <> \'1\')', function () {
      var x = 1,
        y = '1',
        f = $q.eq(x, y);
      expect(f({})).toBeFalsy();
      y=1;
      expect(f({})).toBeFalsy();
      x='1';
      y='1';
      expect(f({})).toBeFalsy();
    });

    it('comparing values with $q.eq between type does matter (1 <> true)', function () {
      var x = 1,
        y = true,
        f = $q.eq(x, y);
      expect(f({})).toBeFalsy();
    });
    it('comparing values with $q.eq between type does matter (0 <> null)', function () {
      var x = null,
        y = 0,
        f = $q.eq(x, y);
      expect(f({})).toBeFalsy();
    });

    it('comparing values with $q.eq:  null and undefined are considered equal', function () {
      var x = {a:null},
        f = $q.eq($q.constant(x.a), $q.constant(x.b));
      expect(f({})).toBeTruthy();
    });

    it('comparing values through field equal', function () {
      var x = {a: 1, b: 2, c: 3},
        f = $q.eq($q.field('a'), 1);
      expect(f(x)).toBeTruthy();
      x.a=2;
      expect(f(x)).toBeFalsy();
    });

    it('comparing values through field not equal', function () {
      var x = {a: 1, b: 2, c: 3},
        f = $q.eq($q.field('a'), 2);
      expect(f(x)).toBeFalsy();
      x.a=2;
      expect(f(x)).toBeTruthy();
    });

    it('comparing two equal fields', function () {
      var x = {a: 1, b: 2, c: 2},
        f = $q.eq($q.field('b'), $q.field('c'));
      expect(f(x)).toBeTruthy();
      x.b=1;
      expect(f(x)).toBeFalsy();
    });

    it('comparing two different fields', function () {
      var x = {a: 1, b: 2, c: 3},
        f = $q.eq($q.field('b'), $q.field('c'));
      expect(f(x)).toBeFalsy();
      x.b=3;
      expect(f(x)).toBeTruthy();
    });

    it('comparing with undefined gives false', function () {
      var x = {a: 1, b: 2, c: 3},
        f = $q.eq($q.field('b'), $q.field('f'));
      expect(f(x)).toBeFalsy();
      x.f =2;
      expect(f(x)).toBeTruthy();
    });

    it('comparing with undefined object gives undefined', function () {
      var x = {a: 1, b: 2, c: 3},
        f = $q.eq($q.field('b'), undefined);
      expect(f(x)).toBeUndefined();
    });


    it('isNullOrEq with first param null is true', function () {
      var x = {a: 1, b: 2, c: 3},
        y = 4,
        f = $q.isNullOrEq($q.field('d'), y);
      expect(f(x)).toBeTruthy();
      y=5;
      expect(f(x)).toBeTruthy();



    });

    it('isNullOrEq with first param not null is like an eq', function () {
      var x = {a: 1, b: 2, c: 3},
        y = 2,
        f = $q.isNullOrEq($q.field('b'), y),
        g;
      expect(f(x)).toBeTruthy();
      g = $q.isNullOrEq($q.field('c'), y);
      expect(g(x)).toBeFalsy();
      y=3;
      expect(f(x)).toBeTruthy();
      expect(g(x)).toBeFalsy();

    });

    it('comparing two equal fields using autofield for first param', function () {
      var x = {a: 1, b: 2, c: 2},
        y= 2,
        field='b',
        f = $q.eq(field, y);
      expect(f(x)).toBeTruthy();
      expect(f.isTrue).toBeUndefined();
      field='a';
      expect(f(x)).toBeTruthy();
      y=10;
      expect(f(x)).toBeTruthy();
      expect(f.isTrue).toBeUndefined();
    });

    it('comparing two equal fields using autofield for first param (with null  as second)', function () {
      var x = {a: 1, b: null, c: 2},
        f = $q.eq('b', 2);
      expect(f(x)).toBeFalsy();
      expect(f.isFalse).toBeUndefined();
    });

    it('comparing two equal fields using autofield for first param (with undefined as second)', function () {
      var x = {a: 1, b: null, c: 2},
        f = $q.eq('f', 2);
      expect(f(x)).toBeFalsy();
      expect(f.isFalse).toBeUndefined();
    });

    it('comparing two equal fields using autofield for first param (with undefined as second) call without params', function () {
      var x = {a: 1, b: null, c: 2},
        f = $q.eq('f', 2);
      expect(f()).toBeUndefined();
    });


    it('comparing two different fields using autofield for first param', function () {
      var x = {a: 1, b: 2, c: 3},
        c2 = $q.field('c'),
        f = $q.eq('b', c2); //f should compare field b with field c
      expect(f(x)).toBeFalsy();
      c2 = $q.field('b');
      expect(f(x)).toBeFalsy();
      x.c=2;
      expect(f(x)).toBeTruthy();
    });


    it('isIn is a function', function () {
      expect($q.isIn).toEqual(jasmine.any(Function));
    });

    it('distinctVal is a function', function () {
      expect($q.distinctVal).toEqual(jasmine.any(Function));
    });

    it('distinctVal should give different values of an array', function () {
      expect($q.distinctVal([1, 2, 3, 4, 2, 3]).length).toBe(4);
    });

    it('distinctVal should give different values of an array including nulls', function () {
      expect($q.distinctVal(['a', 'A', ' ', null, 1]).length).toBe(5);
    });

    it('isIn returns a function', function () {
      var f = $q.isIn('q', ['a', 'A', ' ', null, 1]);
      expect(f).toEqual(jasmine.any(Function));
    });

    it('isIn returns a function with evaluated fields', function () {
      var f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
      expect(f).toEqual(jasmine.any(Function));
    });

    it('isIn(x) returns true if element in list', function () {
      var xx = {x: 1, q: 1},
        f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
      expect(f(xx)).toBeTruthy();
    });

    it('isIn(x) returns false if element not in list', function () {
      var xx = {x: 1, q: 3},
        f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
      expect(f(xx)).toBeFalsy();
    });

    it('isIn(x) returns false on empty list', function () {
      var xx = {x: 1, q: 3},
        f = $q.isIn('q', []);
      expect(f(xx)).toBeFalsy();
    });

    it('isIn(x) returns false if some element undefined', function () {
      var xx = {x: 1, q: 3},
        f = $q.isIn('q', ['a','b',undefined]);
      expect(f(xx)).toBeFalsy();
    });

    it('isIn(x) returns undefined  if object is undefined', function () {
      var xx = {x: 1, q: 3},
        f = $q.isIn('q', ['a', 'b', undefined]);
      expect(f()).toBeUndefined();
    });


    it('isIn(x) compares different if types are different', function () {
      var xx = {x: 1, q: '1'},
        f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
      expect(f(xx)).toBeFalsy();
    });

    it('like with % compares well', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.like('a', 'AAB%');
      expect(f(xx)).toBeTruthy();
    });

    it('like with _ compares well', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.like('a', 'AAB_CC');
      expect(f(xx)).toBeTruthy();
    });


    it('like with null return false', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.like('a', null);
      expect(f(xx)).toBeFalsy();
    });

  });

  describe('concatenation with AND', function(){

    it('empty AND shold give a function with isTrue field set' , function (){
      var f = $q.and([]);
      expect(f.isTrue).toBe(true);
    });

    it('and of false function with other function should be the always false function', function(){
      var xx = {a: 'AABBCC', q: '1'},
        cond1 = $q.like('a', 'AAB_CC'),
        cond2 = $q.eq('q', 1),
        cond3 = $q.constant(false),
        f = $q.and(cond1, cond2, cond3);
      expect(f.isFalse).toBe(true);
      cond3 = $q.constant(true);
      expect(f.isFalse).toBe(true); //check stability of f
    });


    it('and of false function with other function should be the always false function (by array)', function () {
      var xx = {a: 'AABBCC', q: '1'},
        cond1 = $q.like('a', 'AAB_CC'),
        cond2 = $q.eq('q', 1),
        cond3 = $q.constant(false),
        f = $q.and([cond1, cond2, cond3]);
      expect(f.isFalse).toBe(true);
      cond3 = $q.constant(true);
      expect(f.isFalse).toBe(true); //check stability of f
    });


    it('and of a series of function including one undefined and one false gives false', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.and($q.like('a', 'AAB_CC'), $q.eq('q', 1), undefined, $q.constant(false));
      expect(f.isFalse).toBe(true);
    });

    it('and of a series of function including one undefined and one false gives false (by array)', function () {
      var xx = {a: 'AABBCC', q: '1'},
        cond1 = $q.like('a', 'AAB_CC'),
        cond2 = $q.eq('q', 1),
        cond3 = $q.constant(false),
        f = $q.and( [cond1,cond2 , undefined, cond3]);
      expect(f.isFalse).toBe(true);
      cond3 = $q.constant(true);
      expect(f.isFalse).toBe(true);

    });

    it('and of a series of function including one undefined and one dinamically-false gives false', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.and($q.like('a', 'AAB_CC'), $q.eq('q', 2), undefined);
      expect(f(xx)).toBe(false);
    });

    it('and of a series of function including one undefined and one dinamically-false gives false (by array)', function () {
      var xx = {a: 'AABBCC', q: '1'},
        cond1 = $q.like('a', 'AAB_CC'),
        cond2 = $q.eq('q', 2),
        f = $q.and([cond1, cond2, undefined]);
      expect(f(xx)).toBe(false);
      cond2 = $q.eq('q','1');
      expect(f(xx)).toBe(false);
    });


    it('and of a series of function in an undefined context with an always false function gives false', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant('q'), 2), undefined);
      expect(f()).toBe(false);
    });

    it('AND of a series of function in an undefined context with an always false function gives false', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(3), $q.constant(1))), undefined);
      expect(f()).toBe(false);
    });

    it('AND of a series of function in an undefined context with an always false function gives false constant fun', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(3), $q.constant(1))), undefined);
      expect(f.isFalse).toBe(true);
    });
    it('AND of a series of function in an undefined context not always gives false', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.field('a'), $q.constant(1))), undefined);
      expect(f()).toBeUndefined();
    });
  });

  describe('concatenation with OR', function () {
    it('empty OR shold give a function with isFalse field set', function () {
      var f = $q.or([]);
      expect(f.isFalse).toBe(true);
    });

    it('OR of true function with other function should be the always true function', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.or($q.like('a', 'AAB_CC'), $q.eq('q', 1), $q.constant(true));
      expect(f.isTrue).toBe(true);
    });


    it('OR of a series of function including one undefined and one true gives true', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.or($q.like('a', 'AAB_CC'), $q.eq('q', 1),undefined,  $q.constant(true));
      expect(f.isTrue).toBe(true);
    });

    it('OR of a series of function in an undefined context with an always true function gives true', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(1),$q.constant(1))), undefined);
      expect(f()).toBe(true);
    });

    it('OR of a series of function in an undefined context with an always true function gives the true constant function', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(1), $q.constant(1))), undefined);
      expect(f.isTrue).toBe(true);
    });

    it('OR of a series of function in an undefined context not always gives true', function () {
      var xx = {a: 'AABBCC', q: '1'},
        f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.field('a'), $q.constant(1))), undefined);
      expect(f()).toBeUndefined();
    });
  });

  describe('min, max functions', function(){
    it('min should give the minimum expression value in an array', function(){
      var t  = ds.newTable('a'),
        r1 = t.newRow({a:1,b:2}),
        r2 = t.newRow({a:2,b:2}),
        r3 = t.newRow({a:3,b:null}),
        r4 = t.newRow({a:1, b:-1}),
        r5 = t.newRow({a:null,b:null});
      expect($q.min('a')(t.rows)).toBe(1);
      expect($q.min($q.add($q.field('a'),$q.field('b')))(t.rows)).toBe(0);
      expect($q.max($q.add($q.field('a'), $q.field('b')))(t.rows)).toBe(4);
      expect($q.max('a')(t.rows)).toBe(3);
      expect($q.max('b')(t.rows)).toBe(2);
      expect($q.min('a')(t.rows)).toBe(1);
      expect($q.min('b')(t.rows)).toBe(-1);
      t.newRow({a:0});
      expect($q.min('b')(t.rows)).toBe(-1);
    });
  });

  describe('add, mul, sum functions', function() {
    it('should make the add/ mul / sum skipping nulls', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: 1, b: 2,c:null}),
        r2 = t.newRow({a: 2, b: 2}),
        r3 = t.newRow({a: 3, b: null}),
        r4 = t.newRow({a: 1, b: -1}),
        r5 = t.newRow({a: null, b: null});
      expect($q.mul($q.field('a'),$q.field('b'), $q.field('c'))(r1)).toBe(2);
      expect($q.add($q.field('a'), $q.field('b'),$q.field('c'))(r1)).toBe(3);
      expect($q.sum($q.field('a'))(t.rows)).toBe(7);
      expect($q.mul($q.field('a'), $q.field('b'))(r2)).toBe(4);
      expect($q.sum($q.field('b'))(t.rows)).toBe(3);
    });
  });

  describe('sub /div / minus functions', function () {
    it('sub/div should subtract / divide', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: 1, b: 2, c: null}),
        r2 = t.newRow({a: 2, b: 2}),
        r3 = t.newRow({a: 3, b: null}),
        r4 = t.newRow({a: 1, b: -1}),
        r5 = t.newRow({a: null, b: null});
      expect($q.sub($q.field('a'), $q.field('b'))(r1)).toBe(-1);
      expect($q.div($q.field('a'), $q.field('b'))(r1)).toBe(1/2);
      expect($q.sub($q.field('a'), $q.field('b'))(r2)).toBe(0);
      expect($q.div($q.field('a'), $q.field('b'))(r2)).toBe(1);
      expect($q.sub($q.field('a'), $q.field('b'))(r3)).toBe(null);
      expect($q.div($q.field('a'), $q.field('b'))(r3)).toBe(null);
    });

    it('minus expr should change sign to expr', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: 1, b: 2, c: null}),
        r2 = t.newRow({a: 2, b: 2}),
        r3 = t.newRow({a: 3, b: null}),
        r4 = t.newRow({a: 1, b: -1}),
        r5 = t.newRow({a: null, b: null});
      expect($q.minus($q.sub($q.field('a'), $q.field('b')))(r1)).toBe(1);
      expect($q.minus($q.div($q.field('a'), $q.field('b')))(r1)).toBe(-1/2);
      expect($q.minus($q.sub($q.field('a'), $q.field('b')))(r2)).toBe(0);
      expect($q.minus($q.div($q.field('a'), $q.field('b')))(r2)).toBe(-1);
      expect($q.minus($q.sub($q.field('a'), $q.field('b')))(r3)).toBe(null);
      expect($q.minus($q.div($q.field('a'), $q.field('b')))(r3)).toBe(null);
    });
  });

  describe('substring should extract a substring like sql server', function() {
    it('should extract a substring of specified size and position', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: 'a1234', b: 'WXYZ', c: null}),
        r2 = t.newRow({a: 'a2345', b: 2}),
        r3 = t.newRow({a: 'b1234', b: null}),
        r4 = t.newRow({a: 'c2345', b: -1}),
        r5 = t.newRow({a: null, b: null});
      expect($q.substring('a', 1, 2)(r1)).toBe('a1');
      expect($q.substring('a', 3, 2)(r1)).toBe('23');
      expect($q.substring('a', 3, 4)(r1)).toBe('234');
      expect($q.substring('a', 2, 4)(r2)).toBe('2345');
      expect($q.substring('a', 2, 4)(r2)).toBe('2345');
      expect($q.substring($q.concat($q.field('a'),$q.field('b')), 4, 4)(r1)).toBe('34WX');
      expect($q.substring($q.concat($q.field('a'), $q.field('b'), $q.constant('qq')), 4, 8)(r1)).toBe('34WXYZqq');
      expect($q.substring($q.concat($q.field('a'), $q.field('b'), $q.constant('qq')), -2, 8)(r1)).toBe('a1234WXY');
    });
  });

  describe('convertToInt should convert strings into numbers', function(){

    it('should  convert integers', function(){
      var t = ds.newTable('a'),
        r1 = t.newRow({a: '123', b: '012', c: '1234.56'});
      expect($q.convertToInt('a')(r1)).toBe(123);
    });
    it('should  convert 0 prefixed numbers', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: '123', b: '012', c: '1234.56'});
      expect($q.convertToInt('b')(r1)).toBe(12);
    });
    it('should  convert decimal numbers', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: '123', b: '012', c: '1234.56'});
      expect($q.convertToInt('c')(r1)).toBe(1234);
    });
  });

  describe('convertToString should convert object into strings ', function () {

    it('should  convert integers', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: 123, b: '012', c: '1234.56'});
      expect($q.convertToString('a')(r1)).toBe('123');
    });

    it('should  convert decimal numbers', function () {
      var t = ds.newTable('a'),
        r1 = t.newRow({a: '123', b: '012', c: 1234.56});
      expect($q.convertToString('c')(r1)).toBe('1234.56');
    });
  });

  describe('mcmp', function(){
    it('$q.mcmp should be a function', function () {
      expect($q.mcmp).toEqual(jasmine.any(Function));
    });

    it('$q.mcmp should return a function', function () {
      var x = ['a','b'],
        y = {a:1, b:2},
        f = $q.mcmp(x, y);
      expect(f).toEqual(jasmine.any(Function));
    });


    it('$q.mcmp between compatible rows should return true', function () {
      var k = ['a', 'b'],
        y = {a: 1, b: 2,c:4},
        z = {a: 1, b: 2, c: 3},
        f = $q.mcmp(k, y);
      expect(f(z)).toBeTruthy();
      z.a = 2;
      expect(f(z)).toBeFalsy();
    });

    it('$q.mcmp with no keys should be the true constant', function () {
      var k = [],
        y = {a: 1, b: 2, c: 4},
        z = {a: 1, b: 2, c: 3},
        f = $q.mcmp(k, y);
      expect(f.isTrue).toBeTruthy();
    });

    it('$q.mcmp with some null values should be the false constant', function () {
      var k = ['a', 'b'],
        y = {a: null, b: 2, c: 4},
        z = {a: 1, b: 2, c: 3},
        f = $q.mcmp(k, y);
      expect(f.isFalse).toBeTruthy();
    });

  })

});
