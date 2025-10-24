function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if(username === "user" && password === "pass") {
    window.location.href = "duck.html"; // redirect to DuckDuckGo viewer
  } else {
    alert("Invalid credentials");
  }
}
