# Files
Here we have some files that make up the entire SangueSolidario API. Let's explain each file:

* `index.js`: Main file, where the server is started, all routes are defined and the cosmos database is initialized. The large comments are used to define the routes to `swagger-jsdoc` and `swagger-ui-express` to create the Swagger url.
* `db.js`: Here we have a class with all the methods for obtaining results for each route. This class will have the Cosmos database instance initialized previously
* `utils.js`: Auxiliary functions for processing the data
* `swagger.js` - Definition of Swagger and its options to be used with `swagger-jsdoc`.
