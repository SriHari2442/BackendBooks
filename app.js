const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const DbObjectToResponseObject = (dbObject) => {
  return {
    bookId: dbObject.book_id,
    bookPrice: dbObject.book_price,
    authorName: dbObject.author_name,
    bookName: dbObject.book_name,
    category: dbObject.category,
    rating: dbObject.rating,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const getBooksQuery = `
    SELECT
      *
    FROM
     bookstore
    WHERE
      book_id = ${bookId};`;
  const book = await database.get(getBooksQuery);
  response.send(DbObjectToResponseObject(book));
});

app.post("/books/", authenticateToken, async (request, response) => {
  const { bookPrice, authorName, bookName, category, rating } = request.body;
  const postBookQuery = `
  INSERT INTO
    bookstore (book_price, author_name, book_name, category, rating)
  VALUES
    (${bookPrice}, '${authorName}', ${bookName}, ${category}, ${rating});`;
  await database.run(postBookQuery);
  response.send("Book Successfully Added");
});

app.delete("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const deleteBookQuery = `
  DELETE FROM
    bookstore
  WHERE
    book_id = ${bookId} 
  `;
  await database.run(deleteBookQuery);
  response.send("Book Removed");
});

app.put("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const { bookPrice, authorName, bookName, category, rating } = request.body;
  const updateBookQuery = `
  UPDATE
    bookstore
  SET
    bookPrice = '${bookPrice}',
    authorName = ${authorName},
    bookName = ${bookName},
    category = ${category},
    rating = ${rating}, 
  WHERE
    book_id = ${bookId};
  `;

  await database.run(updateBookQuery);
  response.send("Book Details Updated");
});

module.exports = app;
