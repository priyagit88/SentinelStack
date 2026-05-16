import { authClient } from "./lib/auth-client";
console.log("authClient keys:", Object.keys(authClient));
if (authClient.session) {
  console.log("authClient.session keys:", Object.keys(authClient.session));
}
if (authClient.revokeSession) {
  console.log("authClient.revokeSession exists");
}
if (authClient.revokeSessions) {
  console.log("authClient.revokeSessions exists");
}
if (authClient.revokeOtherSessions) {
  console.log("authClient.revokeOtherSessions exists");
}
