<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Identity\RoleAssignmentService;
use App\Domain\Identity\StaffUserService;
use App\Http\Controllers\Controller;
use App\Http\Presenters\UserPresenter;
use App\Http\Responses\ApiResponse;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class UserController extends Controller
{
    public function __construct(
        private readonly RoleAssignmentService $roles,
        private readonly StaffUserService $users,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'filter.user_type' => ['nullable', Rule::in([User::TYPE_STAFF, User::TYPE_CLIENT])],
            'filter.status' => ['nullable', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED, User::STATUS_DEACTIVATED])],
            'filter.role' => ['nullable', 'string', 'max:64'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()->with(['roles', 'employee.team'])->orderBy('name');

        if ($type = data_get($filters, 'filter.user_type')) {
            $query->where('user_type', $type);
        }
        if ($status = data_get($filters, 'filter.status')) {
            $query->where('status', $status);
        }
        if ($role = data_get($filters, 'filter.role')) {
            $query->role($role);
        }
        if ($search = $filters['search'] ?? null) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
        }

        return ApiResponse::paginated($query->paginate($filters['per_page'] ?? 25), UserPresenter::admin(...));
    }

    public function show(User $user): JsonResponse
    {
        return ApiResponse::success(UserPresenter::admin($user->load(['roles', 'employee.team'])));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'mobile' => ['nullable', 'string', 'max:20', Rule::unique('users', 'mobile')],
            'password' => ['required', 'string', Password::defaults()],
            'designation' => ['nullable', 'string', 'max:120'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
            'reports_to_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', Rule::exists('roles', 'name')->where('is_staff', true)],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $user = $this->users->create($request->user(), $data);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])), status: 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'mobile' => ['sometimes', 'nullable', 'string', 'max:20', Rule::unique('users', 'mobile')->ignore($user->id)],
            'designation' => ['sometimes', 'nullable', 'string', 'max:120'],
            'team_id' => ['sometimes', 'nullable', 'integer', 'exists:teams,id'],
            'reports_to_employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $this->users->update($request->user(), $user, $data, $data['reason']);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])));
    }

    public function syncRoles(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'roles' => ['present', 'array'],
            'roles.*' => ['string', 'max:64'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $this->roles->sync($request->user(), $user, $data['roles'], $data['reason']);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])));
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $this->users->deactivate($request->user(), $user, $data['reason']);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])));
    }

    public function reactivate(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $this->users->reactivate($request->user(), $user, $data['reason']);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])));
    }

    public function unlock(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $this->users->unlock($request->user(), $user, $data['reason']);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])));
    }

    public function authorizeResearchPerson(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'authorized' => ['required', 'boolean'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $this->users->setResearchAuthorization($request->user(), $user, (bool) $data['authorized'], $data['reason']);

        return ApiResponse::success(UserPresenter::admin($user->fresh(['roles', 'employee.team'])));
    }
}
