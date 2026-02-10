const express = require("express");
const mysql = require("mysql2");

const app=express();
const path=require("path");
const methodoverride=require("method-override");
const { parseArgs } = require("util");
const { read } = require("fs");
const port=8000;
// const { faker } = require('@faker-js/faker');
const session = require("express-session");

const MySQLStore = require('express-mysql-session')(session);

const store = new MySQLStore({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'dbmsmysql',
  database: 'library'
});

app.use(session({
  secret: "superSecretKey",
  resave: false,
  saveUninitialized: false,
  store: store, // ab session MySQL me save hoga
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));


app.use(methodoverride("_method"));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <--- Add this for form data
app.set("view engine","ejs");
app.use(express.static("public"));
app.set("views",path.join(__dirname,"/views"));


const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "dbmsmysql",   // apna MySQL password daalo
  database: "library"
});


// Connect DB

db.connect(err => {
  if (err) {
    console.error("❌ Database connection failed: " + err.stack);
    return;
  }
  console.log("✅ Connected to MySQL database!");
});

//home route 

app.get("/", (req, res) => {
  let q = "select count(*) as userCount from users";  // alias for easier access

  db.query(q, (err, result) => {
    if (err) {
      console.error(err);   // log error for debugging
      return res.status(500).send("Some error occurred.");
    }app
let count = result[0].userCount;
console.log(count);  // Should print 5
res.render("home.ejs", { count });
  });
});

app.get("/pricing",(req,res)=>{
  res.render("pricing.ejs");
})

app.get("/entry",(req,res)=>{
  res.render("signin.ejs",{ message:'',errors:'',   // sending all errors field-wise
        old: ''           // so user input stays });
})
})

// Signin 

const { body, validationResult } = require("express-validator");
// const { el } = require("@faker-js/faker");

app.post("/signin",
[
    body("name").trim().notEmpty().withMessage("Name is required")
        .isLength({ min: 3 }).withMessage("Name must be at least 3 characters long"),

    body("email").trim().isLowercase().withMessage("All letters must be in lowercase").isEmail().withMessage("Invalid email address"),

    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
        .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
        .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
        .matches(/[0-9]/).withMessage("Password must contain at least one digit")
        .matches(/[!@#$%^&*]/).withMessage("Password must contain at least one Special character")
],
(req, res) => {
    
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        let errorobj = {};

        errors.array().forEach(err => {
            errorobj[err.path] = err.msg;
        });
 console.log({
            message: '',
            errors: errorobj,
            old: req.body
        });
        return res.status(400).render("signin.ejs", {
            message: '',
            errors: errorobj,
            old: req.body
        });
    }

    const { name, email, password } = req.body;

    const q = `
        INSERT INTO users (name, email, password)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE email=email
    `;

    db.query(q, [name, email, password], (err, result) => {

        if (err) {
            return res.status(500).render("signin.ejs", {
                message: "Database error",
                errors: {},
                old: req.body
            });
        }

        if (result.affectedRows === 1) {
            return res.render("index.ejs", { name, email });
        } else {
            return res.render("signin.ejs", {
                message: "You already signed up. Please log in.",
                errors: {},
                old: req.body
            });
        }
    });
});


app.get("/entry_login",(req,res)=>{
  res.render("Login.ejs");
})

app.post("/login",(req,res)=>{
  const {email,password} = req.body;
  let q="select * from users where email=? AND password=?";
  db.query(q,[email,password],(err,result)=>{
    if(err) throw err;
    if(result.length>0){
      req.session.user_id=result[0].id;
      req.session.name = result[0].id;
      let user=result[0];
      console.log(user);
      res.render("index_log.ejs",{user});
    }else{
      res.send("Invalid credentials");
    }
  });
});
// GET library of a particular user (owner)
// GET books for logged-in user
app.post("/library",(req,res)=>{
  res.render("library.ejs");
})

app.get("/books", (req, res) => {
  const ownerId = req.session.user_id;


  if (!ownerId) return res.redirect("/entry_login"); // not logged in

  // Optionally fetch user's name

  const ownerQuery = "SELECT name FROM users WHERE id = ?";
  db.query(ownerQuery, [ownerId], (err, ownerResult) => {
    if (err) return res.status(500).send("DB error fetching user");
    const ownerName = ownerResult.length > 0 ? ownerResult[0].name : "Your";

    // Fetch all books owned by this user

    const booksQuery = `
      SELECT *
      FROM books
      WHERE owner_id = ?
    `;
    db.query(booksQuery, [ownerId], (err, books) => {
      if (err) return res.status(500).send("DB error fetching books");

      res.render("Books.ejs", { owner: { name: ownerName }, books });
    });
  });
});

app.post("/entry_add",(req,res)=>{
  res.render("add_books.ejs");
});

// Add a new book (or increase count if exists)

app.post("/add", (req, res) => {
  const { book_name, author_name, edition, price, row_no, col_no, count } = req.body;
  const ownerId = req.session.user_id;
  if (!ownerId) return res.redirect("/entry_login");

  let q = `
    INSERT INTO books (book_name, author_name, edition, price, row_no, col_no, count, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE count = VALUES(count)+1
  `;

  db.query(
    q,
    [book_name, author_name, edition, price, row_no, col_no, count, ownerId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error adding book");
      }
      res.redirect("/books");
    }
  );
});

//Delete A book 
app.post("/delete",(req,res)=>{
  const {bookid} = req.body;
  let q="select * from books where book_id = ?"
  db.query(q,[bookid],(err,book)=>{
          if (err) {
        console.error(err);
        return res.status(500).send("DB error searching books");
      }
       const count = book[0].count;
      console.log(book,count);
  if(count <= 0){
    let q1 = "delete from  books  where book_id = ?";
    db.query(q1,[bookid],(err,result)=>{
      if(err){
        console.error(err);
        res.status(500).send("DB erro in Deleting book!");
      }
      if(result.affectedRows === 0){
         res.status(400).send("Invalid book Id Or Owner Id!");
      }
      res.redirect("/books");
    })
  }
  else{
    let decrease = "update books set count = count -1 where book_id = ?";
    db.query(decrease,[bookid],(err,response)=>{
      if(err){
        console.log(err);
        res.status(500).send("DB error in Decreasing Count!");
      }
      if(response.affectedRows === 0){
         res.status(400).send("Invalid book Id Or Owner Id!");
      }
      res.redirect("/books");
    })
  }
     })
})

// Search books for logged-in user
app.get("/search_entry",(req,res)=>{
  res.render("search.ejs");
})
app.get("/search", (req, res) => {
  const { book, author } = req.query;
  const ownerId = req.session.user_id;
  if (!ownerId) return res.redirect("/entry_login");

  let searchQuery = `
    SELECT * FROM books
    WHERE owner_id = ? AND (book_name LIKE ? OR author_name LIKE ?)
  `;

  // If no book/author entered → make it never match
  const bookSearch = book ? `%${book}%` : null;
  const authorSearch = author ? `%${author}%` : null;
  // Adjust query if one of them is null
  if (book && author) {
    db.query(searchQuery, [ownerId, bookSearch, authorSearch], (err, books) => {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error searching books");
      }
      res.render("Books.ejs", { books });
    });
  } else if (book) {
    db.query(
      `SELECT * FROM books WHERE owner_id = ? AND book_name LIKE ?`,
      [ownerId, bookSearch],
      (err, books) => {
        if (err) return res.status(500).send("DB error searching books");
        res.render("Books.ejs", { books });
      }
    );
  } else if (author) {
    db.query(
      `SELECT * FROM books WHERE owner_id = ? AND author_name LIKE ?`,
      [ownerId, authorSearch],
      (err, books) => {
        if (err) return res.status(500).send("DB error searching books");
        res.render("Books.ejs", { books });
      }
    );
  } else {
    res.render("Books.ejs", { books: [] }); // nothing searched
  }
});


// Borrow / Buy books

app.post("/books/:id/buy", (req, res) => {
  let bookid=req.params.id;
  res.render("Book_sailed.ejs",{
          book:{bookid: bookid}, 
          errors: {},
      old: {},
      message: " "
});
})

app.post("/books/:id/buy/borrow",
[
  // Name validation
  body("b_name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 3 }).withMessage("Name must be at least 3 characters long")
    .matches(/^[A-Za-z\s]+$/).withMessage("Name must contain only letters and spaces"),

  // Email validation
  body("b_email")
    .trim()
    .isEmail().isLowercase().withMessage("All Letters must be Lowercase").withMessage("Invalid email address"),

  // Mobile number validation
  body("No")
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage("Enter a valid 10-digit mobile number"),

  // Amount validation
  body("amount")
    .isFloat({ gt: 0 }).withMessage("Amount must be a positive number"),

  // Borrow Date
  body("b_date")
    .isISO8601().withMessage("Borrow date must be a valid date"),

  // Return Date
  body("r_date")
    .isISO8601().withMessage("Return date must be a valid date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.b_date)) {
        throw new Error("Return date must be after borrow date");
      }
      return true;
    }),

  // Book ID
  body("bookid")
    .isNumeric().withMessage("Invalid book ID")
],
(req, res) => {

  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let formatted = {};
    errors.array().forEach(err => (formatted[err.path] = err.msg));
    return res.status(400).render("Book_sailed.ejs", {
      errors: formatted,
      old: req.body,
      message: "Please fix the errors"
    });
  }

  // Extract values
  const { b_name, b_email, No, amount, b_date, r_date, bookid } = req.body;

  const book_Id = bookid;
  
  // 1. Insert borrower
  let insertUser = "INSERT INTO borrowers (name, email, no) VALUES (?, ?, ?)";
  db.query(insertUser, [b_name, b_email, No], (err, result) => {
    if (err && err.code !== "ER_DUP_ENTRY") {
      console.error(err);
      return res.status(500).send("DB error borrower Inserting!");
    }

    const ownerId = req.session.user_id;
    if (!ownerId) return res.redirect("/entry_login");

    // 2. Fetch borrower ID
    let q = "SELECT * FROM borrowers WHERE email = ?";
    db.query(q, [b_email], (err, borrower) => {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error borrower not found!");
      }

      const b_id = borrower[0].b_id;

      // 3. Insert transaction
      let q2 =
        "INSERT INTO borrow_transactions (book_id, id, b_id, amount, borrow_date, return_date) VALUES (?,?,?,?,?,?)";
      db.query(q2, [book_Id, ownerId, b_id, amount, b_date, r_date], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).send("DB error transaction!");
        }

        // 4. Update book
        let updateBook = `
          UPDATE books 
          SET count = count - 1 , t_count = t_count + 1
          WHERE book_id = ? AND owner_id = ? AND count > 0
        `;
        db.query(updateBook, [book_Id , ownerId], (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).send("DB error buying book");
          }

          if (result.affectedRows === 0) {
            return res.status(400).send("Book not available or invalid owner");
          }
          res.redirect("/books");
        });
      });
    });
  });
});

app.post("/editBook",(req,res)=>{
  const {book_id} = req.body;
  let q = "select * from books where book_id = ?";
  db.query(q,[book_id],(err,b)=>{
    if(err){
      console.log(err);
    }
  let book = b[0];
res.render("edit_book.ejs", {book});
});
});

app.post("/updateBook",(req,res)=>{
  
    const { book_name, author_name, edition, price, row_no, col_no, count ,book_id} = req.body;
  const ownerId = req.session.user_id;

  if (!ownerId) return res.redirect("/entry_login");
  let q = `
     update books 
     set book_name = ?, author_name = ?, edition = ?, price = ?, row_no = ?, col_no = ?, count = ?, owner_id = ?
     where book_id = ${book_id}
  `;

  db.query(
    q,
    [book_name, author_name, edition, price, row_no, col_no, count, ownerId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send("DB error Updating book");
      }
      res.redirect("/books");
    }
  );
});
  
app.post("/user",(req,res)=>{
  let q="select * from users";
db.query(q,(err,user)=>{
    if(err){
      console.error(err);
      return res.status(500).send("DB error");
    }
    if(user.length===0){
      return res.send("No user found!");
    }
   res.render("users.ejs",{user})
  });
});

app.patch("/user/:id",(req,res)=>{
  let {id} = req.params;
  let {password:formpass, username:newUsername} = req.body;

  let q = "SELECT * FROM users WHERE id=?";
  db.query(q,[id],(err,result)=>{
    if(err){
      console.error(err);
      return res.status(500).send("DB error");
    }
    if(result.length===0){
      return res.send("User not found!");
    }

    let u = result[0];
    if(formpass != u.password){
      return res.send("wrong password!");
    }

    let q2 = "UPDATE users SET name=? WHERE id=?";
    db.query(q2,[newUsername,id],(err,result2)=>{
         console.log(result2);
      if(err){
        console.error(err);
        return res.status(500).send("Update error");
      }
      let user = result[0];
      res.render("user.ejs",{user});
    });
  });
});

app.post("/user",(req,res)=>{
  let q="select * from users";
db.query(q,(err,user)=>{
    if(err){
      console.error(err);
      return res.status(500).send("DB error");
    }
    if(user.length===0){
      return res.send("No user found!");
    }
   res.render("users.ejs",{user})
  });
});

app.patch("/user/:id",(req,res)=>{
  let {id} = req.params;
  let {password:formpass, username:newUsername} = req.body;

  let q = "SELECT * FROM users WHERE id=?";
  db.query(q,[id],(err,result)=>{
    if(err){
      console.error(err);
      return res.status(500).send("DB error");
    }
    if(result.length===0){
      return res.send("User not found!");
    }

    let u = result[0];
    if(formpass != u.password){
      return res.send("wrong password!");
    }

    let q2 = "UPDATE users SET name=? WHERE id=?";
    db.query(q2,[newUsername,id],(err,result2)=>{
         console.log(result2);
      if(err){
        console.error(err);
        return res.status(500).send("Update error");
      }
      let user = result[0];
      res.render("user.ejs",{user});
    });
  });
});

app.post("/transactions",(req,res)=>{
   const {book_id} = req.body;
   let q = "select * from borrow_transactions where book_id = ?";
   db.query(q,[book_id],(err,transactions)=>{
      if(err){
          console.error(err);
        return res.status(500).send("db error!");
      }
      else{
        res.render("transaction.ejs",{transactions});
      }
   })
})

app.post("/transactions/return",(req,res)=>{
   const {transaction_id,book_id} = req.body;
       const ownerId = req.session.user_id;
   let q = "update borrow_transactions  set status = 'returned' where transaction_id = ?";
   db.query(q,[transaction_id],(err,transactions)=>{
      if(err){
          console.error(err);
        return res.status(500).send("db error!");
      }
      else{
         
        let updateBook = `
          UPDATE books 
          SET count = count + 1  WHERE book_id = ? AND owner_id = ?`;
        db.query(updateBook, [book_id, ownerId], (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).send("DB error book");
          }
          res.redirect("/books");
        });
      }
   })
})

app.post("/borrower", (req, res) => {
  const {b_id} = req.body;
  let q2 =`select * from borrowers where b_id = ?`
   db.query(q2,[b_id],(err,result)=>{
 if (err) {
      console.error(err);
      return res.status(500).send("Some error occurred.");
    }

    if (result.length === 0) {
      // No user found
      return res.render("user.ejs", { user: null });
    }
    const user = result[0];
    res.render("user.ejs", { user });
  });
});

app.post("/account", (req, res) => {
  const { name, email } = req.body;

  let q = `SELECT * FROM users WHERE name = ? AND email = ?`;

  db.query(q, [name, email], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Some error occurred.");
    }

    if (result.length === 0) {
      // No user found
      return res.render("user.ejs", { user: null });
    }

    const user = result[0];

    res.render("user.ejs", { user });
  });
});

app.post("/user/:id/edit",(req,res)=>{
  const { name, email } = req.body;
    let q = `SELECT * FROM users WHERE name = ? AND email = ?`;

  db.query(q, [name, email], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Some error occurred.");
    }
    if (result.length === 0) {
      // No user found
      return res.render("user.ejs", { user: null });
    }
    const user = result[0];

  res.render("edit.ejs",{user});
  });

});

app.get("/help",(req,res)=>{
  res.render("help.ejs");
})

app.get("/about",(req,res)=>{
  res.render("about.ejs");
})

app.get("/contact",(req,res)=>{
  res.render("contact.ejs");
})
app.get("/feedback",(req,res)=>{
  res.render("feedback.ejs");
})

app.post("/save",(req,res)=>{
  const {feedback} = req.body;
  const id = req.session.user_id;
   let q="update users set review = ? where id = ?";
   db.query(q,[feedback,id],(err,response)=>{
    if(err){
      console.error(err);
      res.send("DB errror!");
    }
   })
  res.render("library.ejs",{message:"Your feedback is added So Thanks for Your Feedback!"});
});

app.listen(8000, () => {
  console.log("🚀 Server running at http://localhost:8000");
});

// ---------------- Graceful shutdown ----------------
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  db.end(err => {
    if (err) console.error("Error closing DB connection:", err);
    else console.log("DB connection closed");
    process.exit();
  });
});








// try{
// Connection.query("SHOW TABLES",(err ,result)=>{
//   if(err) throw err;
// console.log(result);
// });
//  } catch(err){
//   console.log(result);
// }

// let getRandomUser = () => {
//   return {
//     userId: faker.string.uuid(),
//     username: faker.internet.username(),
//     email: faker.internet.email(),
//     password: faker.internet.password()
//   };
// }

