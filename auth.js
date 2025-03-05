// Sign Up functionality (already implemented)
document.addEventListener('DOMContentLoaded', () => {
    // Handle Sign Up form submission
    const signUpForm = document.getElementById('sign-up-form');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const email = document.getElementById('email').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // Send a POST request to sign up the user
            const response = await fetch('/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password })
            });

            const data = await response.json();
            if (data.success) {
                window.location.href = '/Login.html'; // Redirect to login page after successful sign up
            } else {
                alert(data.message); // Show an error message
            }
        });
    }

    // Handle Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const usernameOrEmail = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            // Send login request to the server
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernameOrEmail, password })
            });

            const data = await response.json();
            if (data.success) {
                // Redirect to main.html after successful login
                window.location.href = '/main.html';
            } else {
                // Show error message if login fails
                const errorMessage = document.getElementById('error-message');
                errorMessage.style.display = 'block';
                errorMessage.textContent = data.message;
            }
        });
    }

     // Add event listeners to buttons
     document.getElementById('submit-public').addEventListener('click', async function () {
        document.getElementById('submission-type').value = 'public';
        await submitCode();
    });

    document.getElementById('submit-private').addEventListener('click', async function () {
        document.getElementById('submission-type').value = 'private';
        await submitCode();
    });

    // Function to submit the code to the server
    async function submitCode() {
        const filename = document.getElementById('filename').value;
        const description = document.getElementById('description').value;
        const content = document.getElementById('code-content').value;
        const submissionType = document.getElementById('submission-type').value;

        const response = await fetch('/submit-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, description, content, submissionType })
        });

        const data = await response.json();
        if (data.success) {
            alert('Code submitted successfully!');
            // Optionally redirect the user to another page
        } else {
            alert('Error submitting code: ' + data.message);
        }
    }
});
fetchUsername();

async function fetchUsername() {
    try {
        const response = await fetch('/api/user'); // Assumes this endpoint returns the logged-in user's data
        if (response.ok) {
            const data = await response.json();
            document.getElementById('username').innerText = data.username;
        } else {
            document.getElementById('username').innerText = 'User not found';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        document.getElementById('username').innerText = 'Error loading username';
    }
}


function logout() {
    fetch('/auth/logout', { method: 'POST' })
        .then(response => {
            if (response.ok) {
                window.location.href = '/login.html'; // Redirect to login page
            } else {
                console.error('Logout failed');
            }
        });
}
