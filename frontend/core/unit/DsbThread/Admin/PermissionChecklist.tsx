type TProps = {
  permissions: string[]
  grantablePermissions: string[]
  onChange: (permission: string, checked: boolean) => void
}

export default function PermissionChecklist({
  permissions,
  grantablePermissions,
  onChange,
}: TProps) {
  return (
    <div
      className='grid max-h-96 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2'
      role='group'
      aria-label='权限细则'
    >
      {grantablePermissions.map((permission) => (
        <label className='flex items-center gap-2 text-sm' key={permission}>
          <input
            type='checkbox'
            checked={permissions.includes(permission)}
            onChange={(event) => onChange(permission, event.target.checked)}
          />
          {permission}
        </label>
      ))}
    </div>
  )
}
