export function fetchPermissions(appName) {
    return navigator.permissions.query(
        { name: appName }
    );
}
