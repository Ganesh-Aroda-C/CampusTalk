// CampusTalk Client Application
// Accessible, Modern, Full-Featured Single-Page Interface

(function () {
  'use strict';

  // State Management
  const state = {
    token: localStorage.getItem('campustalk_token') || null,
    user: JSON.parse(localStorage.getItem('campustalk_user') || 'null'),
    currentView: 'discussions',
    colleges: [],
    courses: [],
    topics: [],
    posts: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    filters: {
      college_id: '',
      course_id: '',
      topic: '',
      q: '',
      sort: 'recent',
      unanswered: ''
    },
    reviews: [],
    reviewPagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    reviewFilters: {
      college: '',
      category: '',
      min_rating: ''
    },
    activeModal: null,
    lastFocusedElement: null
  };

  // Utility: DOM selector
  const $ = (s, doc = document) => doc.querySelector(s);
  const $$ = (s, doc = document) => Array.from(doc.querySelectorAll(s));

  // Utility: HTML Escaping (XSS Prevention)
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Utility: Date formatter
  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Utility: Toast notification (Accessible Live Region)
  function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // API Client with Auth headers
  async function api(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
      const res = await fetch(`/api${endpoint}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && state.token) {
          // Token expired or invalid
          logout(false);
          showToast('Session expired. Please sign in again.', 'error');
        }
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  // Modal Manager (Accessible Focus Trap & Escape Handling)
  function openModal(id) {
    const modal = $(`#${id}`);
    if (!modal) return;

    state.lastFocusedElement = document.activeElement;
    state.activeModal = modal;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    const focusable = modal.querySelectorAll('input, select, textarea, button, [tabindex="0"]');
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }
  }

  function closeModal(id) {
    const modal = id ? $(`#${id}`) : state.activeModal;
    if (!modal) return;

    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    state.activeModal = null;

    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
    }
  }

  // Global Keyboard Listener for Dialogs
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeModal) {
      closeModal();
    }
  });

  // Authentication Actions
  function setSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('campustalk_token', token);
    localStorage.setItem('campustalk_user', JSON.stringify(user));
    updateAuthUI();
  }

  function logout(showMessage = true) {
    state.token = null;
    state.user = null;
    localStorage.removeItem('campustalk_token');
    localStorage.removeItem('campustalk_user');
    updateAuthUI();
    if (showMessage) showToast('Signed out successfully.', 'info');
    loadPosts();
  }

  function updateAuthUI() {
    const authArea = $('#userControls');
    if (!authArea) return;

    if (state.user) {
      const roleBadge = state.user.role === 'current_student'
        ? '<span class="badge badge-student">Current Student</span>'
        : state.user.role === 'admin'
          ? '<span class="badge badge-admin">Admin</span>'
          : '<span class="badge badge-prospective">Prospective Student</span>';

      authArea.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-primary btn-sm" id="btnHeaderNewPost" aria-label="Create a new discussion">
            + Ask Question
          </button>
          <button class="btn btn-secondary btn-sm" id="btnHeaderProfile" style="display:flex; align-items:center; gap:6px;">
            <span>${esc(state.user.name)}</span>
            ${roleBadge}
          </button>
          <button class="btn btn-secondary btn-sm" id="btnHeaderLogout" aria-label="Sign out">
            Sign Out
          </button>
        </div>
      `;

      $('#btnHeaderNewPost')?.addEventListener('click', () => {
        populateCourseSelect('newPostCourse');
        openModal('modalNewPost');
      });

      $('#btnHeaderProfile')?.addEventListener('click', () => {
        openProfileModal();
      });

      $('#btnHeaderLogout')?.addEventListener('click', () => logout());
    } else {
      authArea.innerHTML = `
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btnHeaderLogin">Sign In</button>
          <button class="btn btn-primary btn-sm" id="btnHeaderRegister">Register</button>
        </div>
      `;

      $('#btnHeaderLogin')?.addEventListener('click', () => {
        switchAuthTab('login');
        openModal('modalAuth');
      });

      $('#btnHeaderRegister')?.addEventListener('click', () => {
        switchAuthTab('register');
        openModal('modalAuth');
      });
    }
  }

  function switchAuthTab(tab) {
    const tabLogin = $('#tabLoginBtn');
    const tabReg = $('#tabRegisterBtn');
    const formLogin = $('#formLogin');
    const formReg = $('#formRegister');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
      formLogin.removeAttribute('hidden');
      formReg.setAttribute('hidden', '');
    } else {
      tabReg.classList.add('active');
      tabLogin.classList.remove('active');
      formReg.removeAttribute('hidden');
      formLogin.setAttribute('hidden', '');
    }
  }

  // Populate Course Dropdowns
  function populateCourseSelect(selectId, selectedId = null) {
    const sel = $(`#${selectId}`);
    if (!sel) return;

    if (!state.courses.length) {
      sel.innerHTML = '<option value="">No courses available</option>';
      return;
    }

    // Group courses by college
    const groups = {};
    state.courses.forEach(c => {
      if (!groups[c.college_name]) groups[c.college_name] = [];
      groups[c.college_name].push(c);
    });

    let html = '<option value="">-- Select a College & Course --</option>';
    for (const [colName, courses] of Object.entries(groups)) {
      html += `<optgroup label="${esc(colName)}">`;
      courses.forEach(c => {
        const isSel = selectedId && Number(selectedId) === c.course_id ? 'selected' : '';
        html += `<option value="${c.course_id}" ${isSel}>${esc(c.course_name)} (${esc(c.degree_level)})</option>`;
      });
      html += '</optgroup>';
    }
    sel.innerHTML = html;
  }

  // View Navigation
  function switchView(viewName) {
    state.currentView = viewName;
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
    $$('.view-section').forEach(s => s.classList.toggle('hidden', s.id !== `view-${viewName}`));

    if (viewName === 'discussions') {
      loadPosts();
    } else if (viewName === 'colleges') {
      loadCollegesView();
    } else if (viewName === 'reviews') {
      loadReviews();
      loadReviewSummary();
    } else if (viewName === 'reports') {
      loadAllReports();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Discussion Feed Implementation
  async function loadPosts() {
    const container = $('#postsList');
    if (!container) return;

    container.innerHTML = `
      <div class="post-card" style="padding: 24px;">
        <div class="skeleton" style="height: 20px; width: 40%; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 16px; width: 85%; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 16px; width: 65%;"></div>
      </div>
    `;

    const params = new URLSearchParams({
      page: state.pagination.page,
      limit: state.pagination.limit
    });

    if (state.filters.college_id) params.set('college_id', state.filters.college_id);
    if (state.filters.course_id) params.set('course_id', state.filters.course_id);
    if (state.filters.topic) params.set('topic', state.filters.topic);
    if (state.filters.q) params.set('q', state.filters.q);
    if (state.filters.sort) params.set('sort', state.filters.sort);
    if (state.filters.unanswered) params.set('unanswered', state.filters.unanswered);

    try {
      const data = await api(`/posts?${params}`);
      state.posts = data.posts || [];
      state.pagination = data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };
      renderPosts();
    } catch (err) {
      container.innerHTML = `
        <div class="panel" style="text-align: center; color: var(--danger);">
          <p>Failed to load discussions: ${esc(err.message)}</p>
          <button class="btn btn-secondary btn-sm" onclick="window.CampusTalk.loadPosts()" style="margin-top: 10px;">Retry</button>
        </div>
      `;
    }
  }

  function renderPosts() {
    const container = $('#postsList');
    if (!container) return;

    if (!state.posts.length) {
      container.innerHTML = `
        <div class="panel" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 36px; margin-bottom: 12px;">💬</div>
          <h3 style="font-size: 18px; margin-bottom: 8px;">No discussions match your filter criteria.</h3>
          <p style="color: var(--ink-muted); margin-bottom: 16px;">
            Be the first to start a conversation on this topic or clear your filters.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-secondary btn-sm" id="btnClearFilters">Clear Filters</button>
            <button class="btn btn-primary btn-sm" id="btnEmptyNewPost">+ Ask Question</button>
          </div>
        </div>
      `;

      $('#btnClearFilters')?.addEventListener('click', () => {
        state.filters = { college_id: '', course_id: '', topic: '', q: '', sort: 'recent', unanswered: '' };
        $('#filterCollege').value = '';
        $('#filterTopic').value = '';
        $('#filterSort').value = 'recent';
        $('#filterSearch').value = '';
        $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.topic === ''));
        loadPosts();
      });

      $('#btnEmptyNewPost')?.addEventListener('click', () => {
        if (!state.user) {
          switchAuthTab('login');
          openModal('modalAuth');
        } else {
          populateCourseSelect('newPostCourse');
          openModal('modalNewPost');
        }
      });
      return;
    }

    container.innerHTML = state.posts.map(post => {
      const roleBadge = post.author_role === 'current_student'
        ? '<span class="badge badge-student">Current Student</span>'
        : post.author_role === 'admin'
          ? '<span class="badge badge-admin">Admin</span>'
          : '<span class="badge badge-prospective">Prospective</span>';

      const likeBtnClass = post.user_has_liked ? 'action-btn liked' : 'action-btn';
      const likeText = post.user_has_liked ? '❤️ Liked' : '🤍 Like';

      const authorActions = post.is_author || (state.user && state.user.role === 'admin')
        ? `
          <button class="action-btn btn-edit-post" data-id="${post.post_id}" aria-label="Edit post">Edit</button>
          <button class="action-btn btn-delete-post" data-id="${post.post_id}" aria-label="Delete post" style="color: var(--danger);">Delete</button>
        `
        : '';

      return `
        <article class="post-card" id="post-${post.post_id}">
          <div class="post-meta-top">
            <div class="post-context">
              <span class="badge badge-topic">${esc(post.topic)}</span>
              <strong>${esc(post.college_name)}</strong> · <span>${esc(post.course_name)}</span>
              ${post.academic_year ? `<span>· Year: ${esc(post.academic_year)}</span>` : ''}
            </div>
            ${post.comment_count === 0 ? '<span class="badge badge-prospective">❓ Unanswered Question</span>' : ''}
          </div>

          <h2 class="post-title">${esc(post.title)}</h2>
          <div class="post-body">${esc(post.content)}</div>

          <div class="post-meta-bottom">
            <div class="post-author">
              <strong>${esc(post.author)}</strong>
              ${roleBadge}
              <span>· ${formatDate(post.created_at)}</span>
            </div>

            <div class="post-actions">
              <button class="${likeBtnClass} btn-toggle-like" data-id="${post.post_id}" aria-label="Toggle like">
                ${likeText} (${post.like_count})
              </button>
              <button class="action-btn btn-view-comments" data-id="${post.post_id}" aria-expanded="false">
                💬 Comments (${post.comment_count})
              </button>
              ${authorActions}
            </div>
          </div>

          <div class="comments-container" id="comments-box-${post.post_id}" hidden>
            <div class="comments-list" id="comments-list-${post.post_id}">
              <p style="color: var(--ink-muted); font-size: 13px;">Loading comments...</p>
            </div>

            <form class="add-comment-box" data-post-id="${post.post_id}">
              <textarea class="comment-textarea" placeholder="Write a constructive, helpful comment…" required maxlength="1000"></textarea>
              <button type="submit" class="btn btn-primary btn-sm">Reply</button>
            </form>
          </div>
        </article>
      `;
    }).join('');

    renderPagination();
    attachPostListeners();
  }

  function renderPagination() {
    const container = $('#postsPagination');
    if (!container) return;

    const { page, totalPages, total } = state.pagination;
    if (totalPages <= 1) {
      container.innerHTML = total > 0 ? `<div style="text-align: center; color: var(--ink-muted); font-size: 13px;">Showing all ${total} discussions</div>` : '';
      return;
    }

    container.innerHTML = `
      <div class="pagination">
        <button class="page-btn" id="btnPagePrev" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">
          &larr; Prev
        </button>
        <span style="font-size: 13px; font-weight: 600; padding: 0 8px;">
          Page ${page} of ${totalPages} (${total} total)
        </span>
        <button class="page-btn" id="btnPageNext" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">
          Next &rarr;
        </button>
      </div>
    `;

    $('#btnPagePrev')?.addEventListener('click', () => {
      if (state.pagination.page > 1) {
        state.pagination.page -= 1;
        loadPosts();
      }
    });

    $('#btnPageNext')?.addEventListener('click', () => {
      if (state.pagination.page < state.pagination.totalPages) {
        state.pagination.page += 1;
        loadPosts();
      }
    });
  }

  function attachPostListeners() {
    // Likes
    $$('.btn-toggle-like').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!state.user) {
          showToast('Please sign in to like discussions.', 'info');
          switchAuthTab('login');
          openModal('modalAuth');
          return;
        }
        const postId = btn.dataset.id;
        try {
          const res = await api(`/posts/${postId}/like`, { method: 'POST' });
          btn.className = res.liked ? 'action-btn liked btn-toggle-like' : 'action-btn btn-toggle-like';
          btn.innerHTML = `${res.liked ? '❤️ Liked' : '🤍 Like'} (${res.like_count})`;
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Toggle comments
    $$('.btn-view-comments').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.id;
        const box = $(`#comments-box-${postId}`);
        if (!box) return;

        const isHidden = box.hasAttribute('hidden');
        if (isHidden) {
          box.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
          loadComments(postId);
        } else {
          box.setAttribute('hidden', '');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Add comment form
    $$('.add-comment-box').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.user) {
          showToast('Please sign in to comment.', 'info');
          switchAuthTab('login');
          openModal('modalAuth');
          return;
        }

        const postId = form.dataset.postId;
        const textarea = form.querySelector('textarea');
        const content = textarea.value.trim();

        if (!content) return;

        try {
          await api(`/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
          });
          textarea.value = '';
          showToast('Comment posted successfully.', 'success');
          loadComments(postId);
          // Increment displayed comment count
          const commentBtn = $(`#post-${postId} .btn-view-comments`);
          if (commentBtn) {
            const current = parseInt(commentBtn.textContent.match(/\d+/)?.[0] || '0', 10);
            commentBtn.textContent = `💬 Comments (${current + 1})`;
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Edit Post
    $$('.btn-edit-post').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = Number(btn.dataset.id);
        const post = state.posts.find(p => p.post_id === postId);
        if (!post) return;

        $('#editPostId').value = post.post_id;
        $('#editPostTitle').value = post.title;
        $('#editPostContent').value = post.content;
        $('#editPostTopic').value = post.topic;
        openModal('modalEditPost');
      });
    });

    // Delete Post
    $$('.btn-delete-post').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.id;
        if (!confirm('Are you sure you want to delete this discussion? This action cannot be undone.')) return;

        try {
          await api(`/posts/${postId}`, { method: 'DELETE' });
          showToast('Discussion deleted successfully.', 'success');
          loadPosts();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  async function loadComments(postId) {
    const list = $(`#comments-list-${postId}`);
    if (!list) return;

    try {
      const comments = await api(`/posts/${postId}/comments`);
      if (!comments.length) {
        list.innerHTML = '<p style="color: var(--ink-muted); font-size: 13px; padding: 6px 0;">No comments yet. Share your experience!</p>';
        return;
      }

      list.innerHTML = comments.map(c => {
        const roleBadge = c.author_role === 'current_student'
          ? '<span class="badge badge-student" style="font-size:10px;">Student</span>'
          : c.author_role === 'admin'
            ? '<span class="badge badge-admin" style="font-size:10px;">Admin</span>'
            : '<span class="badge badge-prospective" style="font-size:10px;">Prospective</span>';

        const deleteBtn = c.is_author || (state.user && state.user.role === 'admin')
          ? `<button class="btn-delete-comment" data-id="${c.comment_id}" data-post-id="${postId}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px;">Delete</button>`
          : '';

        return `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">
                ${esc(c.author)} ${roleBadge}
              </span>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span>${formatDate(c.created_at)}</span>
                ${deleteBtn}
              </div>
            </div>
            <div class="comment-body">${esc(c.content)}</div>
          </div>
        `;
      }).join('');

      // Comment delete listeners
      list.querySelectorAll('.btn-delete-comment').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('Delete this comment?')) return;
          try {
            await api(`/comments/${b.dataset.id}`, { method: 'DELETE' });
            showToast('Comment deleted.', 'info');
            loadComments(b.dataset.postId);
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });
    } catch (err) {
      list.innerHTML = `<p style="color: var(--danger); font-size: 13px;">Failed to load comments: ${esc(err.message)}</p>`;
    }
  }

  // College & Course Discovery View
  async function loadCollegesView() {
    const container = $('#collegesGrid');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--ink-muted);">Loading colleges directory…</p>';

    try {
      const colleges = await api('/colleges');
      state.colleges = colleges;

      container.innerHTML = colleges.map(col => {
        const ratingHtml = col.avg_rating
          ? `<span style="color: #f59e0b; font-weight: 700;">★ ${col.avg_rating}</span> <span style="font-size:12px; color:var(--ink-muted);">(${col.review_count} reviews)</span>`
          : '<span style="font-size:12px; color:var(--ink-muted);">No reviews yet</span>';

        return `
          <div class="college-card">
            <div>
              <h3>${esc(col.college_name)}</h3>
              <p>📍 ${esc(col.location)}, ${esc(col.state)} · Est. ${col.established_year || 'N/A'}</p>
              <div>${ratingHtml}</div>

              <div class="college-stats-grid">
                <div>
                  <div class="college-stat-num">${col.course_count}</div>
                  <div class="college-stat-label">Courses</div>
                </div>
                <div>
                  <div class="college-stat-num">${col.post_count}</div>
                  <div class="college-stat-label">Posts</div>
                </div>
                <div>
                  <div class="college-stat-num">${col.review_count}</div>
                  <div class="college-stat-label">Reviews</div>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 14px;">
              <button class="btn btn-primary btn-sm btn-filter-college" data-id="${col.college_id}" data-name="${esc(col.college_name)}" style="flex:1;">
                Discussions
              </button>
              <button class="btn btn-secondary btn-sm btn-review-college" data-name="${esc(col.college_name)}" style="flex:1;">
                Write Review
              </button>
            </div>
          </div>
        `;
      }).join('');

      $$('.btn-filter-college').forEach(b => {
        b.addEventListener('click', () => {
          state.filters.college_id = b.dataset.id;
          $('#filterCollege').value = b.dataset.id;
          switchView('discussions');
        });
      });

      $$('.btn-review-college').forEach(b => {
        b.addEventListener('click', () => {
          if (!state.user) {
            showToast('Please sign in to write a review.', 'info');
            switchAuthTab('login');
            openModal('modalAuth');
            return;
          }
          $('#reviewCollege').value = b.dataset.name;
          openModal('modalNewReview');
        });
      });
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load colleges: ${esc(err.message)}</p>`;
    }
  }

  // Student Reviews View (MongoDB)
  async function loadReviews() {
    const container = $('#reviewsList');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--ink-muted);">Loading student reviews from MongoDB…</p>';

    const params = new URLSearchParams({
      page: state.reviewPagination.page,
      limit: state.reviewPagination.limit
    });

    if (state.reviewFilters.college) params.set('college', state.reviewFilters.college);
    if (state.reviewFilters.category) params.set('category', state.reviewFilters.category);
    if (state.reviewFilters.min_rating) params.set('min_rating', state.reviewFilters.min_rating);

    try {
      const data = await api(`/reviews?${params}`);
      state.reviews = data.reviews || [];
      state.reviewPagination = data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };
      renderReviews();
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load reviews: ${esc(err.message)}</p>`;
    }
  }

  function renderReviews() {
    const container = $('#reviewsList');
    if (!container) return;

    if (!state.reviews.length) {
      container.innerHTML = `
        <div class="panel" style="text-align: center; padding: 30px;">
          <p style="color: var(--ink-muted);">No reviews match your selected criteria.</p>
          <button class="btn btn-primary btn-sm" id="btnEmptyReview" style="margin-top: 10px;">+ Write the First Review</button>
        </div>
      `;
      $('#btnEmptyReview')?.addEventListener('click', () => {
        if (!state.user) {
          switchAuthTab('login');
          openModal('modalAuth');
        } else {
          openModal('modalNewReview');
        }
      });
      return;
    }

    container.innerHTML = state.reviews.map(r => {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const roleBadge = r.user_role === 'current_student'
        ? '<span class="badge badge-student">Current Student</span>'
        : '<span class="badge badge-prospective">Contributor</span>';

      const deleteBtn = r.is_author || (state.user && state.user.role === 'admin')
        ? `<button class="action-btn btn-delete-review" data-id="${r._id}" style="color:var(--danger); font-size:12px;">Delete Review</button>`
        : '';

      const prosBox = r.pros ? `<div class="review-box pros"><strong>Pros:</strong> ${esc(r.pros)}</div>` : '';
      const consBox = r.cons ? `<div class="review-box cons"><strong>Cons:</strong> ${esc(r.cons)}</div>` : '';
      const adviceBox = r.advice_to_juniors ? `<div class="review-box advice"><strong>Advice to Juniors:</strong> ${esc(r.advice_to_juniors)}</div>` : '';

      return `
        <article class="review-card">
          <div class="review-header">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="stars">${stars}</span>
                <span class="badge badge-topic">${esc(r.category)}</span>
              </div>
              <h3 style="font-size: 17px; font-weight: 700; color: var(--ink-primary);">${esc(r.college_name)}</h3>
              <p style="font-size: 13px; color: var(--ink-muted);">${esc(r.course_name)} · Year: ${esc(r.academic_year || 'N/A')}</p>
            </div>
            <div style="text-align: right; font-size: 12px; color: var(--ink-muted);">
              <div>Reviewed by <strong>${esc(r.reviewer_name)}</strong></div>
              <div style="margin-top: 2px;">${roleBadge} · ${formatDate(r.created_at)}</div>
            </div>
          </div>

          ${r.title ? `<div class="review-title">${esc(r.title)}</div>` : ''}
          <div style="color: var(--ink-secondary); font-size: 14.5px; line-height: 1.6; margin-bottom: 10px;">
            ${esc(r.review_text)}
          </div>

          ${prosBox}
          ${consBox}
          ${adviceBox}

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border);">
            <span style="font-size: 12px; color: var(--ink-muted);">🍃 Verified MongoDB NoSQL Document</span>
            ${deleteBtn}
          </div>
        </article>
      `;
    }).join('');

    $$('.btn-delete-review').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this review document from MongoDB?')) return;
        try {
          await api(`/reviews/${b.dataset.id}`, { method: 'DELETE' });
          showToast('Review deleted from MongoDB.', 'success');
          loadReviews();
          loadReviewSummary();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  async function loadReviewSummary() {
    const summaryBox = $('#reviewSummaryStats');
    if (!summaryBox) return;

    try {
      const data = await api('/reviews-summary');
      const overall = data.overall || {};
      const categories = data.categories || [];

      summaryBox.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px;">
          <div class="panel" style="margin: 0; text-align: center; padding: 16px;">
            <div style="font-size: 32px; font-weight: 800; color: #f59e0b;">★ ${overall.avg_rating || '0.0'}</div>
            <div style="font-size: 12px; font-weight: 600; color: var(--ink-muted); text-transform: uppercase;">Average Rating</div>
            <div style="font-size: 12px; color: var(--ink-muted);">${overall.total_reviews || 0} Total Reviews</div>
          </div>
          ${categories.slice(0, 3).map(c => `
            <div class="panel" style="margin: 0; text-align: center; padding: 16px;">
              <div style="font-size: 22px; font-weight: 800; color: var(--primary);">★ ${c.avg_rating}</div>
              <div style="font-size: 12px; font-weight: 600; color: var(--ink-muted); text-transform: uppercase;">${esc(c.category)}</div>
              <div style="font-size: 12px; color: var(--ink-muted);">${c.count} reviews</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      console.warn('Failed to load review summary:', e.message);
    }
  }

  // Reports & Analytics Dashboard (7 Required Reports)
  async function loadAllReports() {
    loadReport1();
    loadReport2();
    loadReport3();
    loadReport4();
    loadReport5();
    loadReport6();
    loadReport7();
  }

  async function loadReport1() {
    const container = $('#rep1Container');
    if (!container) return;
    try {
      const rows = await api('/reports/college-posts');
      const maxPosts = Math.max(...rows.map(r => r.total_posts), 1);

      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>College Name</th>
                <th>Location</th>
                <th>Courses</th>
                <th>Total Posts</th>
                <th>Comments</th>
                <th>Likes</th>
                <th>Activity Graph</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => {
                const widthPercent = Math.round((r.total_posts / maxPosts) * 100);
                return `
                  <tr>
                    <td><strong>${esc(r.college_name)}</strong></td>
                    <td>${esc(r.location)}</td>
                    <td>${r.total_courses}</td>
                    <td><strong>${r.total_posts}</strong></td>
                    <td>${r.total_comments}</td>
                    <td>${r.total_likes}</td>
                    <td style="min-width: 140px;">
                      <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${Math.max(4, widthPercent)}%;"></div>
                        <span style="font-size: 11px; font-weight: 700;">${r.total_posts}</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 1: ${esc(err.message)}</p>`;
    }
  }

  async function loadReport2() {
    const container = $('#rep2Container');
    if (!container) return;
    try {
      const rows = await api('/reports/course-activity');
      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>College</th>
                <th>Course Name</th>
                <th>Degree Level</th>
                <th>Posts</th>
                <th>Comments</th>
                <th>Likes</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${esc(r.college_name)}</td>
                  <td><strong>${esc(r.course_name)}</strong></td>
                  <td>${esc(r.degree_level)}</td>
                  <td>${r.total_posts}</td>
                  <td>${r.total_comments}</td>
                  <td>${r.total_likes}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 2: ${esc(err.message)}</p>`;
    }
  }

  async function loadReport3() {
    const container = $('#rep3Container');
    if (!container) return;
    try {
      const rows = await api('/reports/topic-counts');
      const maxPosts = Math.max(...rows.map(r => r.total_posts), 1);

      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>Topic Category</th>
                <th>Total Posts</th>
                <th>Share (%)</th>
                <th>Comments</th>
                <th>Likes</th>
                <th>Share Bar</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => {
                const widthPercent = Math.round((r.total_posts / maxPosts) * 100);
                return `
                  <tr>
                    <td><strong>${esc(r.topic)}</strong></td>
                    <td>${r.total_posts}</td>
                    <td>${r.percentage || '0'}%</td>
                    <td>${r.total_comments}</td>
                    <td>${r.total_likes}</td>
                    <td style="min-width: 140px;">
                      <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${Math.max(4, widthPercent)}%; background-color: var(--accent);"></div>
                        <span style="font-size: 11px;">${r.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 3: ${esc(err.message)}</p>`;
    }
  }

  async function loadReport4() {
    const container = $('#rep4Container');
    if (!container) return;
    try {
      const rows = await api('/reports/useful-discussions?limit=10');
      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>Discussion Title</th>
                <th>Topic</th>
                <th>College & Course</th>
                <th>Author</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Usefulness Score</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${esc(r.title)}</strong></td>
                  <td><span class="badge badge-topic">${esc(r.topic)}</span></td>
                  <td>${esc(r.college_name)} · ${esc(r.course_name)}</td>
                  <td>${esc(r.author_name)}</td>
                  <td>${r.total_likes}</td>
                  <td>${r.total_comments}</td>
                  <td><strong style="color: var(--primary);">${r.usefulness_score} pts</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 4: ${esc(err.message)}</p>`;
    }
  }

  async function loadReport5() {
    const container = $('#rep5Container');
    if (!container) return;
    try {
      const rows = await api('/reports/average-ratings');
      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>College Name</th>
                <th>Course Name</th>
                <th>Average Rating</th>
                <th>Rating Range</th>
                <th>Total Reviews</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${esc(r.college_name)}</strong></td>
                  <td>${esc(r.course_name)}</td>
                  <td><strong style="color: #f59e0b;">★ ${r.avg_rating}</strong></td>
                  <td>${r.min_rating} to ${r.max_rating} Stars</td>
                  <td>${r.total_reviews}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 5: ${esc(err.message)}</p>`;
    }
  }

  async function loadReport6() {
    const container = $('#rep6Container');
    if (!container) return;
    try {
      const rows = await api('/reports/reviews-by-category');
      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>College Name</th>
                <th>Category</th>
                <th>Reviews Count</th>
                <th>Average Rating</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${esc(r.college_name)}</strong></td>
                  <td><span class="badge badge-topic">${esc(r.category)}</span></td>
                  <td>${r.total_reviews}</td>
                  <td><span style="color: #f59e0b;">★ ${r.avg_rating}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 6: ${esc(err.message)}</p>`;
    }
  }

  async function loadReport7() {
    const container = $('#rep7Container');
    if (!container) return;
    try {
      const rows = await api('/reports/monthly-activity');
      container.innerHTML = `
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>Month (YYYY-MM)</th>
                <th>MySQL Discussions</th>
                <th>Active Authors</th>
                <th>MongoDB Reviews</th>
                <th>Combined Activity</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${esc(r.month)}</strong></td>
                  <td>${r.posts_count}</td>
                  <td>${r.active_authors}</td>
                  <td>${r.reviews_count}</td>
                  <td><strong>${r.posts_count + r.reviews_count}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger);">Failed to load Report 7: ${esc(err.message)}</p>`;
    }
  }

  // Profile Modal
  async function openProfileModal() {
    if (!state.user) return;
    try {
      const profile = await api('/auth/me');
      $('#profileName').value = profile.name || '';
      $('#profileEmail').value = profile.email || '';
      $('#profileRole').textContent = profile.role === 'current_student' ? 'Current Student' : (profile.role === 'admin' ? 'Administrator' : 'Prospective Student');
      $('#profileYear').value = profile.academic_year || '';
      $('#profileBio').value = profile.bio || '';
      $('#profileInterests').value = profile.interests || '';
      $('#profilePostsCount').textContent = profile.posts_count || 0;
      $('#profileCommentsCount').textContent = profile.comments_count || 0;

      populateCourseSelect('profileCourse', profile.course_id);
      openModal('modalProfile');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Initial App Setup
  async function init() {
    updateAuthUI();

    // Check backend health
    try {
      const health = await api('/health');
      const connPill = $('#connStatus');
      if (connPill) {
        connPill.innerHTML = `<span class="dot"></span> MySQL: ${esc(health.mysql)} · MongoDB: ${esc(health.mongodb)}`;
        if (health.mysql !== 'connected' || health.mongodb !== 'connected') {
          connPill.classList.add('error');
        }
      }
    } catch (e) {
      const connPill = $('#connStatus');
      if (connPill) {
        connPill.innerHTML = '<span class="dot" style="background:#ef4444"></span> Connection issue';
        connPill.classList.add('error');
      }
    }

    // Load initial reference data: colleges, courses, topics
    try {
      const [colleges, courses, topics] = await Promise.all([
        api('/colleges'),
        api('/courses'),
        api('/topics')
      ]);

      state.colleges = colleges;
      state.courses = courses;
      state.topics = topics;

      // Populate filter dropdowns
      const colFilter = $('#filterCollege');
      if (colFilter) {
        colleges.forEach(c => {
          colFilter.insertAdjacentHTML('beforeend', `<option value="${c.college_id}">${esc(c.college_name)}</option>`);
        });
      }

      const topicFilter = $('#filterTopic');
      if (topicFilter) {
        topics.forEach(t => {
          topicFilter.insertAdjacentHTML('beforeend', `<option value="${t.topic_name}">${esc(t.topic_name)}</option>`);
        });
      }

      // Populate review form colleges
      const revCol = $('#reviewCollege');
      if (revCol) {
        colleges.forEach(c => {
          revCol.insertAdjacentHTML('beforeend', `<option value="${esc(c.college_name)}">${esc(c.college_name)}</option>`);
        });
      }

      // Load initial feed
      loadPosts();
    } catch (e) {
      showToast('Failed to load initial data. Check server connection.', 'error');
    }

    // Attach Event Listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    // Navigation
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Modals close buttons
    $$('.modal-close, .btn-modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => closeModal());
    });

    // Close on overlay click
    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    });

    // Filter controls
    $('#filterCollege')?.addEventListener('change', (e) => {
      state.filters.college_id = e.target.value;
      state.pagination.page = 1;
      loadPosts();
    });

    $('#filterTopic')?.addEventListener('change', (e) => {
      state.filters.topic = e.target.value;
      state.pagination.page = 1;
      $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.topic === e.target.value));
      loadPosts();
    });

    $('#filterSort')?.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      if (e.target.value === 'unanswered') {
        state.filters.unanswered = 'true';
      } else {
        state.filters.unanswered = '';
      }
      state.pagination.page = 1;
      loadPosts();
    });

    // Debounced search
    let searchTimer;
    $('#filterSearch')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.q = e.target.value.trim();
        state.pagination.page = 1;
        loadPosts();
      }, 300);
    });

    // Topic Filter Chips
    $$('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        if (chip.dataset.special === 'unanswered') {
          state.filters.unanswered = 'true';
          state.filters.topic = '';
          $('#filterTopic').value = '';
          $('#filterSort').value = 'unanswered';
        } else if (chip.dataset.special === 'popular') {
          state.filters.unanswered = '';
          state.filters.topic = '';
          $('#filterSort').value = 'popular';
          $('#filterTopic').value = '';
        } else {
          state.filters.unanswered = '';
          state.filters.topic = chip.dataset.topic || '';
          $('#filterTopic').value = chip.dataset.topic || '';
        }

        state.pagination.page = 1;
        loadPosts();
      });
    });

    // Hero buttons
    $('#heroBtnExplore')?.addEventListener('click', () => switchView('colleges'));
    $('#heroBtnDiscussions')?.addEventListener('click', () => switchView('discussions'));
    $('#heroBtnReviews')?.addEventListener('click', () => switchView('reviews'));

    // Auth Form Tabs
    $('#tabLoginBtn')?.addEventListener('click', () => switchAuthTab('login'));
    $('#tabRegisterBtn')?.addEventListener('click', () => switchAuthTab('register'));

    // Demo account quick fill
    $$('.demo-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        switchAuthTab('login');
        $('#loginEmail').value = pill.dataset.email;
        $('#loginPassword').value = pill.dataset.password;
      });
    });

    // Login Submission
    $('#formLogin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;

      try {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setSession(data.token, data.user);
        closeModal('modalAuth');
        showToast(`Welcome back, ${data.user.name}!`, 'success');
        loadPosts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Register Submission
    $('#formRegister')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#regName').value.trim();
      const email = $('#regEmail').value.trim();
      const password = $('#regPassword').value;
      const role = $('#regRole').value;
      const academic_year = $('#regYear').value.trim();

      try {
        const data = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role, academic_year })
        });
        setSession(data.token, data.user);
        closeModal('modalAuth');
        showToast(`Account created! Welcome to CampusTalk, ${data.user.name}.`, 'success');
        loadPosts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // New Post Submission
    $('#formNewPost')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.user) {
        switchAuthTab('login');
        openModal('modalAuth');
        return;
      }

      const course_id = Number($('#newPostCourse').value);
      const title = $('#newPostTitle').value.trim();
      const content = $('#newPostContent').value.trim();
      const topic = $('#newPostTopic').value;

      try {
        await api('/posts', {
          method: 'POST',
          body: JSON.stringify({ course_id, title, content, topic })
        });
        $('#formNewPost').reset();
        closeModal('modalNewPost');
        showToast('Discussion published successfully!', 'success');
        state.pagination.page = 1;
        loadPosts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Edit Post Submission
    $('#formEditPost')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const postId = $('#editPostId').value;
      const title = $('#editPostTitle').value.trim();
      const content = $('#editPostContent').value.trim();
      const topic = $('#editPostTopic').value;

      try {
        await api(`/posts/${postId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content, topic })
        });
        closeModal('modalEditPost');
        showToast('Discussion updated successfully.', 'success');
        loadPosts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Review Filters
    $('#revFilterCategory')?.addEventListener('change', (e) => {
      state.reviewFilters.category = e.target.value;
      state.reviewPagination.page = 1;
      loadReviews();
    });

    $('#revFilterRating')?.addEventListener('change', (e) => {
      state.reviewFilters.min_rating = e.target.value;
      state.reviewPagination.page = 1;
      loadReviews();
    });

    $('#btnOpenNewReview')?.addEventListener('click', () => {
      if (!state.user) {
        showToast('Please sign in to write a review.', 'info');
        switchAuthTab('login');
        openModal('modalAuth');
        return;
      }
      openModal('modalNewReview');
    });

    // Submit Review Form
    $('#formNewReview')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const college_name = $('#reviewCollege').value.trim();
      const course_name = $('#reviewCourse').value.trim();
      const category = $('#reviewCategory').value;
      const rating = Number($('#reviewRating').value);
      const title = $('#reviewTitle').value.trim();
      const review_text = $('#reviewText').value.trim();
      const pros = $('#reviewPros').value.trim();
      const cons = $('#reviewCons').value.trim();
      const advice_to_juniors = $('#reviewAdvice').value.trim();

      try {
        await api('/reviews', {
          method: 'POST',
          body: JSON.stringify({
            college_name,
            course_name,
            category,
            rating,
            title,
            review_text,
            pros,
            cons,
            advice_to_juniors
          })
        });
        $('#formNewReview').reset();
        closeModal('modalNewReview');
        showToast('Review document saved in MongoDB!', 'success');
        loadReviews();
        loadReviewSummary();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Profile Form Submission
    $('#formProfile')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#profileName').value.trim();
      const academic_year = $('#profileYear').value.trim();
      const bio = $('#profileBio').value.trim();
      const interests = $('#profileInterests').value.trim();
      const course_id = $('#profileCourse').value ? Number($('#profileCourse').value) : null;

      try {
        await api('/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name, academic_year, bio, interests, course_id })
        });
        state.user.name = name;
        state.user.academic_year = academic_year;
        state.user.bio = bio;
        state.user.interests = interests;
        localStorage.setItem('campustalk_user', JSON.stringify(state.user));
        updateAuthUI();
        closeModal('modalProfile');
        showToast('Profile updated successfully.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Report CSV Export buttons
    $$('.btn-export-csv').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.report;
        window.location.href = `/api/reports/export/${type}`;
      });
    });
  }

  // Expose global for debugging & tests
  window.CampusTalk = {
    state,
    api,
    loadPosts,
    loadReviews,
    switchView,
    openModal,
    closeModal
  };

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
