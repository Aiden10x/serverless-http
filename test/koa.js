'use strict';

const koa = require('koa'),
  route = require('koa-route'),
  bodyparser = require('koa-bodyparser'),
  serve = require('koa-serve'),
  Router = require('koa-router'),
  expect = require('chai').expect,
  serverless = require('../serverless-http');

describe('koa', () => {
  let app, perform;

  beforeEach(function() {
    app = koa();
    perform = function(request) {
      const handler = serverless(app);
      return new Promise((resolve, reject) => {
        handler(request, null, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        });
      });
    }
  });

  it('basic middleware should set statusCode and default body', () => {
    app.use(function* (next) {
      this.status = 418;
      yield* next;
    });

    return perform({
      httpMethod: 'GET',
      path: '/'
    })
    .then(response => {
      expect(response.statusCode).to.equal(418);
      expect(response.body).to.equal('I\'m a teapot')
    });
  });

  it('basic middleware should receive queryString', () => {
    app.use(function* (next) {
      this.body = this.query.x;
      yield* next;
    });

    return perform({
      httpMethod: 'GET',
      path: '/',
      queryStringParameters: {
        x: 'y'
      }
    })
    .then(response => {
      expect(response.body).to.equal('y');
    });
  });


  it('basic middleware should set statusCode and custom body', () => {
    app.use(function* (next) {
      this.status = 201;
      this.body = { foo: 'bar' };
      yield* next;
    });

    return perform({
      httpMethod: 'GET',
      path: '/'
    })
    .then(response => {
      expect(response.statusCode).to.equal(201);
      expect(response.body).to.equal('{"foo":"bar"}');
    });
  });

  it('basic middleware should set headers', () => {
    app.use(function* (next) {
      this.body = { "test": "foo" };
      this.set('X-Test-Header', 'foo');
      yield* next;
    });

    return perform({
      httpMethod: 'GET',
      path: '/'
    })
    .then(response => {
      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.deep.equal({
        'Content-Length': '14',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Test-Header': 'foo'
      });
    });
  });

  it('basic middleware should get headers', () => {
    let headers;
    app.use(function* (next) {
      headers = this.request.headers;
      this.status = 204;
      yield* next;
    });

    return perform({
      httpMethod: 'GET',
      path: '/',
      headers: {
        'X-Request-Id': 'abc'
      }
    })
    .then(response => {
      expect(response.statusCode).to.equal(204);
      expect(headers).to.deep.equal({
        'x-request-id': 'abc'
      });
    });
  });

  it('error middleware should set statusCode and default body', () => {
    app.use(function* () {
      throw new Error('hey man, nice shot');
    });
    return perform({
      httpMethod: 'GET',
      path: '/'
    })
    .then(response => {
      expect(response.statusCode).to.equal(500);
      expect(response.body).to.equal('Internal Server Error')
    });
  });

  describe('koa-route', () => {

    beforeEach(() => {
      app.use(route.get('/foo', function* () {
        this.body = 'foo';
      }));
      app.use(route.get('/foo/:bar', function* (bar) {
        this.body = bar;
      }));
      app.use(route.post('/foo', function* () {
        this.status = 201;
        this.body = 'Thanks';
      }));
    });

    it('should get path information when it matches exactly', () => {
      return perform({
        httpMethod: 'GET',
        path: '/foo'
      })
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.equal('foo')
      });
    });

    it('should get path information when it matches with params', () => {
      return perform({
        httpMethod: 'GET',
        path: '/foo/baz'
      })
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.equal('baz')
      });
    });

    it('should get method information', () => {
      return perform({
        httpMethod: 'POST',
        path: '/foo'
      })
      .then(response => {
        expect(response.statusCode).to.equal(201);
        expect(response.body).to.equal('Thanks')
      });
    });

    it('should allow 404s', () => {
      return perform({
        httpMethod: 'POST',
        path: '/missing'
      })
      .then(response => {
        expect(response.statusCode).to.equal(404);
      });
    });

    describe('koa-router', function() {

      beforeEach(() => {
        const router = new Router();

        router.get('/', function* () {
          this.body = yield Promise.resolve('hello');
        });

        app.use(router.routes());
        app.use(router.allowedMethods());
      });

      it('should get when it matches', function() {
        return perform({
          httpMethod: 'GET',
          path: '/'
        })
        .then((response) => {
          expect(response.statusCode).to.equal(200);
          expect(response.body).to.equal('hello');
        });
      });

      it('should 404 when route does not match', function() {
        return perform({
          httpMethod: 'GET',
          path: '/missing'
        })
        .then((response) => {
          expect(response.statusCode).to.equal(404);
        });
      });
    });

    describe('koa-bodyparser', () => {

      beforeEach(() => {
        app.use(bodyparser());
      });

      it('should parse json', () => {
        const body = `{"foo":"bar"}`;

        let actual;
        app.use(function*() {
          this.status = 204;
          this.body = {};
          actual = this.request.body;
        });
        return perform({
          httpMethod: 'GET',
          path: '/',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length
          },
          body
        })
        .then(() => {
          expect(actual).to.deep.equal({
            "foo": "bar"
          });
        });
      });
    });

    describe('koa-serve', () => {

      beforeEach(() => {
        app.use(serve('test'));
      });

      it('should parse json', () => {
        return perform({
          httpMethod: 'GET',
          path: '/test/file.txt'
        })
        .then((response) => {
          expect(response.body).to.equal('this is a test\n');
        });
      });
    })
  });
});
