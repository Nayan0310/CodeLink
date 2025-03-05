const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const app = express();

// Middleware
app.use(bodyParser.json()); // Parse JSON data
app.use(bodyParser.urlencoded({ extended: true })); // Handle form submissions
app.use(express.static(__dirname))


// Session management
app.use(session({
    secret: '1324-4231-3412',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost/session-db' }),
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Connect to MongoDB
mongoose.connect('mongodb://localhost/user-auth')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// Define the Code schema to store both public and private codes
const codeSchema = new mongoose.Schema({
    filename: String,
    description: String, // Keep the description field
    content: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to the user who submitted the code
    visibility: { type: String, enum: ['public', 'private'], default: 'public' }, // Public or Private
    createdAt: { type: Date, default: Date.now }
});

const Code = mongoose.model('Code', codeSchema);



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/info.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'info.html'));
});

// Route to serve SignUp.html (signup page)
app.get('/SignUp.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'SignUp.html'));
});



app.post('/auth/signup', async (req, res) => {
    const { email, username, password } = req.body;

    try {
        // Check if the email or username is already in use
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email or Username already in use.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the new user to the database
        const newUser = new User({ email, username, password: hashedPassword });
        await newUser.save();

        // Return success response as JSON
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ success: false, message: 'Error during signup.' });
    }
});


// Route to serve Login.html (login page)
app.get('/Login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Login.html'));
});

// Route to handle Login
app.post('/auth/login', async (req, res) => {
    const { usernameOrEmail, password } = req.body;

    try {
        // Find the user by username or email
        const user = await User.findOne({
            $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
        });

        if (!user) {
            return res.json({ success: false, message: 'User not found.' });
        }

        // Compare the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: 'Incorrect password.' });
        }

        // Save the user session
        req.session.user = user;
        res.json({ success: true });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'Error during login.' });
    }
});

// Serve main.html from the public directory (after login)
app.get('/main.html',ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});


// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        // User is authenticated, allow them to proceed
        return next();
    } else {
        // Check if the request is an API request or a page request
        if (req.originalUrl.startsWith('/api')) {
            // If it's an API request, return a 401 status with a JSON response
            return res.status(401).json({ message: 'Unauthorized access' });
        } else {
            // If it's a page request, redirect to the login page
            return res.redirect('/Login.html');
        }
    }
}

// Route to fetch protected data (example API)
app.get('/api/protected-data', ensureAuthenticated, (req, res) => {
    res.json({ message: 'This is protected data' });
});

// Route to submit code (form on main.html)
app.post('/submit-code', ensureAuthenticated, async (req, res) => {
    const { filename, description, content, submissionType } = req.body; // Capture the description as well
    const userId = req.session.user._id;

    try {
        // Save the code with the description and correct visibility (public or private)
        const code = new Code({
            filename,
            description, // Save description in the code object
            content,
            user: userId,
            visibility: submissionType === 'public' ? 'public' : 'private' // Determine visibility
        });
        await code.save();

        res.json({ success: true, message: `Code submitted as ${submissionType}.` });
    } catch (error) {
        console.error('Error submitting code:', error);
        res.status(500).json({ success: false, message: 'Error submitting code.' });
    }
});


app.get('/api/public-codes', async (req, res) => {
    try {
        // Fetch the latest 10 public codes and populate the 'user' field to get the username
        const publicCodes = await Code.find({ visibility: 'public' })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'username'); // Populate only the username of the user

        // Return only the first 10 lines of each code
        const updatedCodes = publicCodes.map(code => {
            const codeLines = code.content.split('\n'); // Split the content into lines
            const first10Lines = codeLines.slice(0, 10).join('\n'); // Get the first 10 lines

            return {
                _id: code._id,
                filename: code.filename,
                description: code.description,
                username: code.user.username, // Get the username
                content: first10Lines, // Return only the first 10 lines for preview
                createdAt: code.createdAt
            };
        });

        res.json(updatedCodes);
    } catch (error) {
        console.error('Error fetching public codes:', error);
        res.status(500).json({ message: 'Server error' });
    }
});




// Route to fetch full code by ID and populate user details
app.get('/api/full-code/:id', async (req, res) => {
    try {
        // Find the code by ID and populate the 'user' field to get the username
        const code = await Code.findById(req.params.id).populate('user', 'username');

        if (code) { // Allow both public and private codes (if logged-in user owns it)
            // Return the full code along with the username and other details
            res.json({ 
                content: code.content,
                filename: code.filename,
                description: code.description,
                username: code.user.username // Get the populated username
            });
        } else {
            res.status(404).json({ message: 'Code not found or unauthorized' });
        }
    } catch (error) {
        console.error('Error fetching full code:', error);
        res.status(500).json({ message: 'Server error' });
    }
});






// Route to serve fullcode.html
app.get('/fullcode.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fullcode.html'));
});

// Route to fetch the username of the authenticated user
app.get('/api/user', ensureAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        if (user) {
            res.json({ username: user.username });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Protecting the myCode.html (your gists)
app.get('/myCode.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'myCode.html'));
});

// all the gists submitted by user
app.get('/api/my-codes', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id; // Get the logged-in user's ID
        const userCodes = await Code.find({ user: userId }).sort({ createdAt: -1 });

        if (!userCodes.length) {
            return res.json({ success: false, message: "No codes found" });
        }

        // Return all codes submitted by the user
        res.json({ success: true, codes: userCodes });
    } catch (error) {
        console.error('Error fetching user codes:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Change Password Route
app.post('/auth/change-password', ensureAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user._id; // Get the logged-in user's ID

    try {
        // Find the user by their ID
        const user = await User.findById(userId);

        // Validate the current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        user.password = hashedNewPassword;
        await user.save();

        // Log the user out (destroy the session)
        req.session.destroy((err) => {
            if (err) {
                console.error('Error during logout after password change:', err);
                return res.status(500).json({ success: false, message: 'Error logging out after password change.' });
            }

            // Redirect to login page with a success message
            res.json({ success: true, message: 'Password changed successfully. Please log in with your new password.' });
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Server error, please try again.' });
    }
});




// Prevent caching of protected pages globally
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});


// Logout Route: Destroy session and clear cookies
app.post('/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error logging out.' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/Login.html'); // Redirect to login page after logging out
    });
});


// Start the server
const PORT = process.env.PORT || 4000; // Change to a different port like 4000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

