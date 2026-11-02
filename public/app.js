// CampusTalk — Intuitive, Instagram-Inspired Student Community Client
// Fast, Accessible (WCAG 2.2 AA), Content-Focused

(function () {
  'use strict';

  // Application State
  const state = {
    token: localStorage.getItem('campustalk_token') || null,
    user: JSON.parse(localStorage.getItem('campustalk_user') || 'null'),
    currentView: 'home',
    previousView: 'home',
    selectedCollege: null,
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
    notifications: [],
    activeModal: null,
    lastFocusedEl: null
  };

  // Helper DOM Selectors
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  // Security: XSS Sanitization
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Relative Time Formatter (Instagram-style "2h ago", "3d ago", "Just now")
  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const past = new Date(dateStr);
    const diffSeconds = Math.max(0, Math.floor((now - past) / 1000));

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Initials generator for avatars
  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // Toast Notification
  function showToast(message) {
    const shelf = $('#toastShelf');
    if (!shelf) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    shelf.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Authenticated API Fetcher
  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
      const res = await fetch(`/api${path}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && state.token) {
          logout(false);
          showToast('Session expired. Please sign in again.');
        }
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  // Accessible Modal Manager
  function openModal(id) {
    const modal = $(`#${id}`);
    if (!modal) return;
    state.lastFocusedEl = document.activeElement;
    state.activeModal = modal;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

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
    if (state.lastFocusedEl && typeof state.lastFocusedEl.focus === 'function') {
      state.lastFocusedEl.focus();
    }
  }

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeModal) {
      closeModal();
    }
  });

  // Authentication State
  function setSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('campustalk_token', token);
    localStorage.setItem('campustalk_user', JSON.stringify(user));
    updateAuthUI();
  }

  function logout(showMsg = true) {
    state.token = null;
    state.user = null;
    localStorage.removeItem('campustalk_token');
    localStorage.removeItem('campustalk_user');
    updateAuthUI();
    if (showMsg) showToast('Signed out');
    switchView('home');
  }

  function updateAuthUI() {
    const sidebarUser = $('#sidebarUserArea');
    const railUser = $('#railUserWidget');
    const sidebarDbStatus = $('#sidebarNavDbStatus');
    const settingsAdminWidget = $('#settingsAdminWidget');

    if (state.user && state.user.role === 'admin') {
      if (sidebarDbStatus) sidebarDbStatus.style.display = 'flex';
      if (settingsAdminWidget) settingsAdminWidget.removeAttribute('hidden');
    } else {
      if (sidebarDbStatus) sidebarDbStatus.style.display = 'none';
      if (settingsAdminWidget) settingsAdminWidget.setAttribute('hidden', '');
    }

    if (state.user) {
      const initials = getInitials(state.user.name);
      const roleText = state.user.role === 'current_student'
        ? 'Current Student'
        : (state.user.role === 'admin' ? 'Administrator' : 'Prospective Student');

      if (sidebarUser) {
        sidebarUser.innerHTML = `
          <div class="user-profile-tile" id="btnSidebarProfileTile" title="View Profile">
            <div class="user-avatar">${initials}</div>
            <div class="user-tile-meta">
              <div class="user-tile-name">${esc(state.user.name)}</div>
              <div class="user-tile-role">${esc(roleText)}</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btnSidebarSignOutSmall" style="padding:4px 8px; font-size:11px;" title="Sign out">Log out</button>
          </div>
        `;
        $('#btnSidebarProfileTile')?.addEventListener('click', (e) => {
          if (e.target.id !== 'btnSidebarSignOutSmall') switchView('profile');
        });
        $('#btnSidebarSignOutSmall')?.addEventListener('click', (e) => {
          e.stopPropagation();
          logout();
        });
      }

      if (railUser) {
        railUser.removeAttribute('hidden');
        $('#railAvatar').textContent = initials;
        $('#railUserName').textContent = state.user.name;
        $('#railUserRole').textContent = roleText;
      }
    } else {
      if (sidebarUser) {
        sidebarUser.innerHTML = `<button class="btn btn-primary" id="btnSidebarSignIn" style="width:100%;">Sign In</button>`;
        $('#btnSidebarSignIn')?.addEventListener('click', () => {
          switchAuthTab('login');
          openModal('modalAuth');
        });
      }
      if (railUser) railUser.setAttribute('hidden', '');
    }
  }

  function switchAuthTab(tab) {
    const btnLogin = $('#btnTabAuthLogin');
    const btnReg = $('#btnTabAuthRegister');
    const formLogin = $('#formModalLogin');
    const formReg = $('#formModalRegister');

    if (tab === 'login') {
      btnLogin.className = 'btn btn-sm btn-primary';
      btnReg.className = 'btn btn-sm btn-secondary';
      formLogin.removeAttribute('hidden');
      formReg.setAttribute('hidden', '');
    } else {
      btnReg.className = 'btn btn-sm btn-primary';
      btnLogin.className = 'btn btn-sm btn-secondary';
      formReg.removeAttribute('hidden');
      formLogin.setAttribute('hidden', '');
    }
  }

  // View Navigation System
  function switchView(viewName, params = {}) {
    state.previousView = state.currentView;
    state.currentView = viewName;

    // Stop DB auto-refresh if navigating away from database-status
    if (state.previousView === 'database-status' && viewName !== 'database-status') {
      stopDbAutoRefresh();
    }

    // Update Desktop Sidebar items
    $$('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update Mobile Bottom Nav items
    $$('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Hide all view containers
    $$('.view-container').forEach(c => c.setAttribute('hidden', ''));

    // Show active view
    const target = $(`#view-${viewName}`);
    if (target) {
      target.removeAttribute('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // View specific activation
    if (viewName === 'home') {
      loadHomeFeed();
    } else if (viewName === 'explore') {
      loadExploreColleges();
    } else if (viewName === 'college-detail') {
      if (params.college) {
        renderCollegeDetail(params.college);
      }
    } else if (viewName === 'discussions') {
      loadDiscussionsView();
    } else if (viewName === 'reviews') {
      loadReviewsView();
    } else if (viewName === 'notifications') {
      loadNotificationsView();
    } else if (viewName === 'profile') {
      loadProfileView();
    } else if (viewName === 'settings') {
      loadSettingsView();
    } else if (viewName === 'database-status') {
      loadDatabaseStatusView();
    }
  }

  // Populate Course Dropdown by College
  function setupCourseSelectOptions(collegeSelectId, courseSelectId, preselectedCourseId = null) {
    const colSel = $(`#${collegeSelectId}`);
    const crsSel = $(`#${courseSelectId}`);
    if (!colSel || !crsSel) return;

    function refreshCourses() {
      const colId = Number(colSel.value);
      if (!colId) {
        crsSel.innerHTML = '<option value="">Select college first…</option>';
        crsSel.disabled = true;
        return;
      }
      const matched = state.courses.filter(c => c.college_id === colId);
      if (!matched.length) {
        crsSel.innerHTML = '<option value="">No courses listed</option>';
        crsSel.disabled = false;
        return;
      }
      crsSel.disabled = false;
      crsSel.innerHTML = '<option value="">-- Choose Course --</option>' + matched.map(c => {
        const isSel = preselectedCourseId && Number(preselectedCourseId) === c.course_id ? 'selected' : '';
        return `<option value="${c.course_id}" ${isSel}>${esc(c.course_name)} (${esc(c.degree_level)})</option>`;
      }).join('');
    }

    colSel.addEventListener('change', refreshCourses);
    refreshCourses();
  }

  // =========================================================================
  // VIEW 1: HOME FEED (Instagram-Inspired)
  // =========================================================================

  async function loadHomeFeed() {
    const stream = $('#homeFeedStream');
    if (!stream) return;

    stream.innerHTML = `
      <div class="post-card" style="padding: 24px; text-align: center; color: var(--ink-muted);">
        Loading discussions…
      </div>
    `;

    const params = new URLSearchParams({
      page: state.pagination.page,
      limit: state.pagination.limit,
      sort: state.filters.sort || 'recent'
    });

    if (state.filters.topic) params.set('topic', state.filters.topic);
    if (state.filters.college_id) params.set('college_id', state.filters.college_id);
    if (state.filters.q) params.set('q', state.filters.q);
    if (state.filters.unanswered) params.set('unanswered', state.filters.unanswered);

    try {
      const data = await api(`/posts?${params}`);
      state.posts = data.posts || [];
      state.pagination = data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };
      renderHomePosts();
      renderHomePagination();
    } catch (err) {
      stream.innerHTML = `
        <div class="post-card" style="padding: 28px; text-align: center; color: var(--danger);">
          <p>Failed to load discussions: ${esc(err.message)}</p>
          <button class="btn btn-secondary btn-sm" onclick="window.CampusTalk.loadHomeFeed()" style="margin-top: 10px;">Retry</button>
        </div>
      `;
    }
  }

  function renderHomePosts() {
    const stream = $('#homeFeedStream');
    if (!stream) return;

    if (!state.posts.length) {
      stream.innerHTML = `
        <div class="post-card" style="padding: 40px 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 12px;">💬</div>
          <h2 style="font-size: 17px; font-weight: 700; margin-bottom: 6px;">No discussions match your filter</h2>
          <p style="color: var(--ink-muted); font-size: 13.5px; margin-bottom: 16px;">
            Be the first to start a conversation on this topic or clear your search filters.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-secondary btn-sm" id="btnResetHomeFilters">Clear Filters</button>
            <button class="btn btn-primary btn-sm" id="btnEmptyAsk">+ Ask a Question</button>
          </div>
        </div>
      `;

      $('#btnResetHomeFilters')?.addEventListener('click', resetHomeFilters);
      $('#btnEmptyAsk')?.addEventListener('click', triggerAskFlow);
      return;
    }

    stream.innerHTML = state.posts.map(post => {
      const initials = getInitials(post.author);
      const isLiked = Boolean(post.user_has_liked);
      const likeBtnClass = isLiked ? 'post-action-btn liked' : 'post-action-btn';

      // Truncate long content with clean "more" expander
      const isLong = post.content && post.content.length > 220;
      const snippet = isLong ? post.content.slice(0, 210) + '…' : post.content;

      const authorActions = post.is_author || (state.user && state.user.role === 'admin')
        ? `
          <button class="btn-more-menu btn-edit-post" data-id="${post.post_id}" style="background:none; border:none; color:var(--ink-muted); font-size:12px; cursor:pointer;">Edit</button>
          <button class="btn-more-menu btn-del-post" data-id="${post.post_id}" style="background:none; border:none; color:var(--danger); font-size:12px; cursor:pointer;">Delete</button>
        `
        : '';

      return `
        <article class="post-card" id="post-${post.post_id}">
          <!-- Post Header -->
          <div class="post-header">
            <div class="post-author-lockup">
              <div class="user-avatar" style="width:38px; height:38px;">${initials}</div>
              <div style="min-width: 0;">
                <div class="post-author-name">
                  <span>${esc(post.author)}</span>
                  ${post.comment_count === 0 ? '<span style="font-size:10px; font-weight:700; background:#fef3c7; color:#92400e; padding:1px 6px; border-radius:99px;">Needs Answer</span>' : ''}
                </div>
                <div class="post-context-line">
                  <strong>${esc(post.college_name)}</strong> &middot; ${esc(post.course_name)} &middot; ${formatRelativeTime(post.created_at)}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="post-topic-tag">${esc(post.topic)}</span>
              ${authorActions}
            </div>
          </div>

          <!-- Post Content -->
          <div class="post-content-area">
            <a href="#" class="post-title-link btn-open-post" data-id="${post.post_id}">
              ${esc(post.title)}
            </a>
            <div class="post-snippet" id="snippet-${post.post_id}">
              ${esc(snippet)}
            </div>
            ${isLong ? `<button class="post-more-toggle" data-id="${post.post_id}">more</button>` : ''}
          </div>

          <!-- Post Actions (Instagram Like / Comment / Share) -->
          <div class="post-action-bar">
            <div class="action-left-group">
              <button class="${likeBtnClass} btn-toggle-like" data-id="${post.post_id}" aria-label="Like post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="like-num">${post.like_count || 0}</span>
              </button>

              <button class="post-action-btn btn-toggle-comments" data-id="${post.post_id}" aria-label="Comments">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>${post.comment_count || 0}</span>
              </button>

              <button class="post-action-btn btn-share-post" data-id="${post.post_id}" aria-label="Share discussion">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>

            <div style="font-size: 12px; color: var(--ink-faint);">
              ${post.view_count || 0} views
            </div>
          </div>

          <!-- Comments Drawer -->
          <div class="post-comments-section" id="comments-section-${post.post_id}" hidden>
            <div class="comments-stream" id="comments-stream-${post.post_id}">
              <p style="font-size:12.5px; color:var(--ink-muted);">Loading answers…</p>
            </div>

            <!-- Inline Add Comment Input -->
            <form class="inline-comment-form" data-post-id="${post.post_id}">
              <input type="text" class="inline-comment-input" placeholder="Add an answer or comment…" required maxlength="1000">
              <button type="submit" class="inline-comment-btn">Post</button>
            </form>
          </div>
        </article>
      `;
    }).join('');

    attachHomePostListeners();
  }

  function renderHomePagination() {
    const container = $('#homePagination');
    if (!container) return;
    const { page, totalPages, total } = state.pagination;

    if (totalPages <= 1) {
      container.innerHTML = total > 0 ? `<div style="text-align:center; color:var(--ink-muted); font-size:12.5px; padding:12px;">Showing all ${total} discussions</div>` : '';
      return;
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px;">
        <button class="btn btn-secondary btn-sm" id="btnFeedPrev" ${page <= 1 ? 'disabled' : ''}>&larr; Previous</button>
        <span style="font-size:13px; font-weight:600; color:var(--ink-muted); padding:0 8px;">Page ${page} of ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" id="btnFeedNext" ${page >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
      </div>
    `;

    $('#btnFeedPrev')?.addEventListener('click', () => {
      if (state.pagination.page > 1) {
        state.pagination.page -= 1;
        loadHomeFeed();
      }
    });

    $('#btnFeedNext')?.addEventListener('click', () => {
      if (state.pagination.page < state.pagination.totalPages) {
        state.pagination.page += 1;
        loadHomeFeed();
      }
    });
  }

  function attachHomePostListeners() {
    // Like button toggle
    $$('.btn-toggle-like').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!state.user) {
          showToast('Sign in to like discussions');
          switchAuthTab('login');
          openModal('modalAuth');
          return;
        }

        const postId = btn.dataset.id;
        try {
          const res = await api(`/posts/${postId}/like`, { method: 'POST' });
          btn.classList.toggle('liked', res.liked);
          const numSpan = btn.querySelector('.like-num');
          if (numSpan) numSpan.textContent = res.like_count;
        } catch (e) {
          showToast(e.message);
        }
      });
    });

    // Expand "more" content
    $$('.post-more-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.id;
        const post = state.posts.find(p => p.post_id === Number(postId));
        const snippetEl = $(`#snippet-${postId}`);
        if (post && snippetEl) {
          snippetEl.textContent = post.content;
          btn.remove();
        }
      });
    });

    // Toggle comments
    $$('.btn-toggle-comments').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.id;
        const sec = $(`#comments-section-${postId}`);
        if (!sec) return;
        const isHidden = sec.hasAttribute('hidden');
        if (isHidden) {
          sec.removeAttribute('hidden');
          loadPostComments(postId);
        } else {
          sec.setAttribute('hidden', '');
        }
      });
    });

    // Inline comment submission
    $$('.inline-comment-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.user) {
          showToast('Sign in to answer');
          switchAuthTab('login');
          openModal('modalAuth');
          return;
        }

        const postId = form.dataset.postId;
        const input = form.querySelector('.inline-comment-input');
        const content = input.value.trim();
        if (!content) return;

        try {
          await api(`/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
          });
          input.value = '';
          showToast('Answer posted!');
          loadPostComments(postId);

          // Update comment count
          const commentBtn = $(`#post-${postId} .btn-toggle-comments span`);
          if (commentBtn) {
            const count = parseInt(commentBtn.textContent || '0', 10);
            commentBtn.textContent = count + 1;
          }
        } catch (err) {
          showToast(err.message);
        }
      });
    });

    // Share button
    $$('.btn-share-post').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.id;
        const url = `${window.location.origin}/#post-${postId}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard!'));
        } else {
          showToast('Discussion link copied');
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
    $$('.btn-del-post').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.id;
        if (!confirm('Delete this question?')) return;
        try {
          await api(`/posts/${postId}`, { method: 'DELETE' });
          showToast('Question deleted');
          loadHomeFeed();
        } catch (err) {
          showToast(err.message);
        }
      });
    });
  }

  async function loadPostComments(postId) {
    const stream = $(`#comments-stream-${postId}`);
    if (!stream) return;

    try {
      const comments = await api(`/posts/${postId}/comments`);
      if (!comments.length) {
        stream.innerHTML = '<p style="font-size:12.5px; color:var(--ink-muted); padding:4px 0;">No answers yet. Share your experience!</p>';
        return;
      }

      stream.innerHTML = comments.map(c => {
        const canDelete = c.is_author || (state.user && state.user.role === 'admin');
        return `
          <div class="comment-bubble">
            <div class="comment-bubble-header">
              <span class="comment-bubble-author">${esc(c.author)}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="comment-bubble-time">${formatRelativeTime(c.created_at)}</span>
                ${canDelete ? `<button class="btn-del-comment" data-id="${c.comment_id}" data-post-id="${postId}" style="background:none; border:none; color:var(--danger); font-size:11px; cursor:pointer;">Delete</button>` : ''}
              </div>
            </div>
            <div class="comment-bubble-body">${esc(c.content)}</div>
          </div>
        `;
      }).join('');

      stream.querySelectorAll('.btn-del-comment').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('Delete comment?')) return;
          try {
            await api(`/comments/${b.dataset.id}`, { method: 'DELETE' });
            showToast('Comment removed');
            loadPostComments(b.dataset.postId);
          } catch (e) {
            showToast(e.message);
          }
        });
      });
    } catch (e) {
      stream.innerHTML = `<p style="font-size:12px; color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  function resetHomeFilters() {
    state.filters = { college_id: '', course_id: '', topic: '', q: '', sort: 'recent', unanswered: '' };
    $('#homeSearchInput').value = '';
    $('#homeSearchClear').setAttribute('hidden', '');
    $$('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.topic === '' && !p.dataset.special));
    updateActiveFilterBadge();
    loadHomeFeed();
  }

  function updateActiveFilterBadge() {
    const container = $('#activeFilterBadgeContainer');
    if (!container) return;

    const parts = [];
    if (state.filters.topic) parts.push(`Topic: ${state.filters.topic}`);
    if (state.filters.unanswered) parts.push('Unanswered Questions');
    if (state.filters.q) parts.push(`"${state.filters.q}"`);

    if (parts.length > 0) {
      container.innerHTML = `
        <span class="active-filter-badge">
          ${esc(parts.join(' &middot; '))}
          <button type="button" class="btn-clear-active" id="btnQuickClearFilters" aria-label="Clear active filters">&times;</button>
        </span>
      `;
      $('#btnQuickClearFilters')?.addEventListener('click', resetHomeFilters);
    } else {
      container.innerHTML = '';
    }
  }

  // =========================================================================
  // VIEW 2: EXPLORE COLLEGES & COLLEGE DETAIL
  // =========================================================================

  async function loadExploreColleges() {
    const grid = $('#exploreCollegesGrid');
    if (!grid) return;
    grid.innerHTML = '<p style="color:var(--ink-muted);">Loading colleges…</p>';

    try {
      const colleges = await api('/colleges');
      state.colleges = colleges;
      renderCollegeGrid(colleges);
    } catch (err) {
      grid.innerHTML = `<p style="color:var(--danger);">Failed to load colleges: ${esc(err.message)}</p>`;
    }
  }

  function renderCollegeGrid(colleges) {
    const grid = $('#exploreCollegesGrid');
    if (!grid) return;

    if (!colleges.length) {
      grid.innerHTML = '<p style="color:var(--ink-muted);">No colleges match your search.</p>';
      return;
    }

    grid.innerHTML = colleges.map(col => {
      const ratingHtml = col.avg_rating
        ? `<span style="color:#f59e0b; font-weight:700;">★ ${col.avg_rating}</span> <span style="font-size:12px; color:var(--ink-muted);">(${col.review_count || 0})</span>`
        : '<span style="font-size:12px; color:var(--ink-muted);">No reviews yet</span>';

      return `
        <div class="college-tile" data-id="${col.college_id}">
          <div class="college-tile-header">
            <h3 class="college-tile-name">${esc(col.college_name)}</h3>
            <div class="college-tile-loc">📍 ${esc(col.location)}, ${esc(col.state)}</div>
          </div>

          <div>
            ${ratingHtml}
            <div class="college-metrics-row">
              <div class="college-metric">
                <span class="metric-val">${col.course_count || 0}</span>
                <span class="metric-lbl">Courses</span>
              </div>
              <div class="college-metric">
                <span class="metric-val">${col.post_count || 0}</span>
                <span class="metric-lbl">Discussions</span>
              </div>
              <div class="college-metric">
                <span class="metric-val">${col.review_count || 0}</span>
                <span class="metric-lbl">Reviews</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm btn-open-college" data-id="${col.college_id}" style="width:100%;">
              View College &rarr;
            </button>
          </div>
        </div>
      `;
    }).join('');

    $$('.btn-open-college, .college-tile').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = el.dataset.id || el.closest('.college-tile')?.dataset.id;
        if (id) openCollegeDetail(Number(id));
      });
    });
  }

  async function openCollegeDetail(collegeId) {
    try {
      const college = await api(`/colleges/${collegeId}`);
      state.selectedCollege = college;
      switchView('college-detail', { college });
    } catch (e) {
      showToast(e.message);
    }
  }

  function renderCollegeDetail(college) {
    $('#collegeDetailName').textContent = college.college_name;
    $('#collegeDetailLocation').textContent = `📍 ${college.location}, ${college.state} · Established ${college.established_year || 'N/A'}`;

    // Action buttons in hero
    $('#btnDetailAskQuestion').onclick = () => {
      triggerAskFlow(college.college_id);
    };

    $('#btnDetailWriteReview').onclick = () => {
      if (!state.user) {
        showToast('Sign in to write a review');
        switchAuthTab('login');
        openModal('modalAuth');
        return;
      }
      $('#revCollege').value = college.college_name;
      openModal('modalReview');
    };

    // Render discussions subtab by default
    renderCollegeSubtab('discussions');

    $$('.detail-tab-btn').forEach(btn => {
      btn.onclick = () => {
        $$('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCollegeSubtab(btn.dataset.subtab);
      };
    });
  }

  async function renderCollegeSubtab(subtab) {
    const container = $('#collegeDetailSubtabContent');
    const college = state.selectedCollege;
    if (!container || !college) return;

    if (subtab === 'discussions') {
      container.innerHTML = '<p style="color:var(--ink-muted);">Loading discussions for this college…</p>';
      try {
        const res = await api(`/posts?college_id=${college.college_id}`);
        const posts = res.posts || [];
        if (!posts.length) {
          container.innerHTML = `
            <div class="post-card" style="padding: 24px; text-align: center;">
              <p style="color: var(--ink-muted);">No questions asked about ${esc(college.college_name)} yet.</p>
              <button class="btn btn-primary btn-sm" onclick="window.CampusTalk.triggerAskFlow(${college.college_id})" style="margin-top:10px;">
                + Ask the First Question
              </button>
            </div>
          `;
          return;
        }
        container.innerHTML = posts.map(p => `
          <div class="post-card" style="margin-bottom:14px; padding:18px;">
            <div style="font-size:12px; color:var(--ink-muted); margin-bottom:4px;">
              ${esc(p.topic)} &middot; ${esc(p.course_name)} &middot; ${formatRelativeTime(p.created_at)}
            </div>
            <h4 style="font-size:16px; font-weight:700; margin-bottom:6px;">${esc(p.title)}</h4>
            <p style="font-size:14px; color:var(--ink-secondary); margin-bottom:10px;">${esc(p.content)}</p>
            <div style="font-size:12.5px; color:var(--ink-muted); display:flex; gap:14px;">
              <span>💬 ${p.comment_count} answers</span>
              <span>🤍 ${p.like_count} likes</span>
            </div>
          </div>
        `).join('');
      } catch (e) {
        container.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
      }
    } else if (subtab === 'reviews') {
      const reviews = college.reviews || [];
      if (!reviews.length) {
        container.innerHTML = `
          <div class="post-card" style="padding: 24px; text-align: center;">
            <p style="color: var(--ink-muted);">No student reviews submitted for ${esc(college.college_name)} yet.</p>
            <button class="btn btn-primary btn-sm" onclick="window.CampusTalk.triggerReviewFlow('${esc(college.college_name)}')" style="margin-top:10px;">
              Write the First Review
            </button>
          </div>
        `;
        return;
      }
      container.innerHTML = reviews.map(r => `
        <div class="review-card">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <div>
              <span class="review-rating-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
              <span style="font-weight:700; margin-left:6px;">${esc(r.category)}</span>
            </div>
            <span style="font-size:12px; color:var(--ink-muted);">${formatRelativeTime(r.created_at)}</span>
          </div>
          <h4 style="font-size:15px; font-weight:700; margin-bottom:4px;">${esc(r.title || 'Student Review')}</h4>
          <p style="font-size:14px; color:var(--ink-secondary); line-height:1.5;">${esc(r.review_text)}</p>
          ${r.pros ? `<div class="review-callout pros"><strong>Pros:</strong> ${esc(r.pros)}</div>` : ''}
          ${r.cons ? `<div class="review-callout cons"><strong>Cons:</strong> ${esc(r.cons)}</div>` : ''}
          ${r.advice_to_juniors ? `<div class="review-callout advice"><strong>Advice:</strong> ${esc(r.advice_to_juniors)}</div>` : ''}
        </div>
      `).join('');
    } else if (subtab === 'courses') {
      const courses = college.courses || [];
      container.innerHTML = `
        <div class="post-card" style="padding: 16px;">
          <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">Degree Programs Offered</h3>
          <ul style="list-style:none; display:flex; flex-direction:column; gap:10px;">
            ${courses.map(c => `
              <li style="padding:10px; background:var(--bg-subtle); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong>${esc(c.course_name)}</strong>
                  <div style="font-size:12px; color:var(--ink-muted);">${esc(c.degree_level)} &middot; ${c.duration_years || 4} Years</div>
                </div>
                <span style="font-size:12px; font-weight:600; color:var(--primary);">${c.post_count || 0} discussions</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else if (subtab === 'overview') {
      container.innerHTML = `
        <div class="post-card" style="padding: 20px;">
          <h3 style="font-size:16px; font-weight:700; margin-bottom:10px;">About ${esc(college.college_name)}</h3>
          <p style="font-size:14px; color:var(--ink-secondary); line-height:1.6; margin-bottom:14px;">
            ${esc(college.college_name)} is located in ${esc(college.location)}, ${esc(college.state)}. It offers ${college.course_count || (college.courses && college.courses.length) || 0} degree courses with active student mentorship discussions on CampusTalk.
          </p>
          ${college.website ? `<p style="font-size:13.5px;"><a href="${esc(college.website)}" target="_blank" rel="noopener">Visit Official Website &rarr;</a></p>` : ''}
        </div>
      `;
    }
  }

  // =========================================================================
  // VIEW 4 & 5: DISCUSSIONS & REVIEWS DEDICATED
  // =========================================================================

  async function loadDiscussionsView() {
    const stream = $('#discussionsFeedStream');
    if (!stream) return;
    stream.innerHTML = '<p style="color:var(--ink-muted);">Loading discussions…</p>';

    const params = new URLSearchParams();
    if ($('#discCollegeSelect').value) params.set('college_id', $('#discCollegeSelect').value);
    if ($('#discTopicSelect').value) params.set('topic', $('#discTopicSelect').value);
    if ($('#discSortSelect').value) params.set('sort', $('#discSortSelect').value);
    if ($('#discSearchInput').value.trim()) params.set('q', $('#discSearchInput').value.trim());

    try {
      const data = await api(`/posts?${params}`);
      state.posts = data.posts || [];
      renderHomePosts();
    } catch (e) {
      stream.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  async function loadReviewsView() {
    const stream = $('#reviewsStream');
    if (!stream) return;
    stream.innerHTML = '<p style="color:var(--ink-muted);">Loading student reviews…</p>';

    const params = new URLSearchParams();
    if (state.reviewFilters.college) params.set('college', state.reviewFilters.college);
    if (state.reviewFilters.category) params.set('category', state.reviewFilters.category);

    try {
      const data = await api(`/reviews?${params}`);
      state.reviews = data.reviews || [];

      if (!state.reviews.length) {
        stream.innerHTML = `
          <div class="post-card" style="padding:32px; text-align:center;">
            <p style="color:var(--ink-muted); margin-bottom:12px;">No reviews found matching these filters.</p>
            <button class="btn btn-primary btn-sm" id="btnEmptyWriteReview">+ Write a Review</button>
          </div>
        `;
        $('#btnEmptyWriteReview')?.addEventListener('click', () => triggerReviewFlow());
        return;
      }

      stream.innerHTML = state.reviews.map(r => `
        <article class="review-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
              <span class="review-rating-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
              <h3 style="font-size:16px; font-weight:800; color:var(--ink-primary); margin-top:2px;">${esc(r.college_name)}</h3>
              <div style="font-size:12.5px; color:var(--ink-muted);">${esc(r.course_name)} &middot; ${esc(r.category)}</div>
            </div>
            <div style="text-align:right; font-size:12px; color:var(--ink-muted);">
              <div>by <strong>${esc(r.reviewer_name)}</strong></div>
              <div>${formatRelativeTime(r.created_at)}</div>
            </div>
          </div>

          ${r.title ? `<h4 style="font-size:15px; font-weight:700; margin-bottom:6px;">${esc(r.title)}</h4>` : ''}
          <div style="font-size:14px; color:var(--ink-secondary); line-height:1.55; margin-bottom:8px;">${esc(r.review_text)}</div>

          ${r.pros ? `<div class="review-callout pros"><strong>Pros:</strong> ${esc(r.pros)}</div>` : ''}
          ${r.cons ? `<div class="review-callout cons"><strong>Cons:</strong> ${esc(r.cons)}</div>` : ''}
          ${r.advice_to_juniors ? `<div class="review-callout advice"><strong>Advice:</strong> ${esc(r.advice_to_juniors)}</div>` : ''}
        </article>
      `).join('');
    } catch (e) {
      stream.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  // =========================================================================
  // VIEW 6: NOTIFICATIONS
  // =========================================================================

  async function loadNotificationsView() {
    const stream = $('#notificationsStream');
    if (!stream) return;

    if (!state.user) {
      stream.innerHTML = `
        <div class="post-card" style="padding: 30px; text-align: center;">
          <p style="color: var(--ink-muted); margin-bottom: 12px;">Sign in to see activity on your questions and answers.</p>
          <button class="btn btn-primary btn-sm" onclick="window.CampusTalk.openSignIn()">Sign In</button>
        </div>
      `;
      return;
    }

    stream.innerHTML = '<p style="color: var(--ink-muted);">Loading activity…</p>';

    try {
      const items = await api('/notifications');
      state.notifications = items;

      if (!items.length) {
        stream.innerHTML = `
          <div class="post-card" style="padding: 40px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">🔔</div>
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">No notifications yet</h3>
            <p style="color: var(--ink-muted); font-size: 13px;">When students reply or like your questions, updates will appear here.</p>
          </div>
        `;
        return;
      }

      stream.innerHTML = items.map(n => {
        const isComment = n.type === 'comment';
        const iconSvg = isComment
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

        const actionText = isComment
          ? `<strong>${esc(n.actor_name)}</strong> answered your question <em>"${esc(n.post_title)}"</em>`
          : `<strong>${esc(n.actor_name)}</strong> liked your question <em>"${esc(n.post_title)}"</em>`;

        return `
          <div class="notification-item">
            <div class="notification-icon-wrap">${iconSvg}</div>
            <div style="flex:1;">
              <div class="notification-text">${actionText}</div>
              ${n.content ? `<div style="font-size:12.5px; color:var(--ink-muted); margin-top:3px;">"${esc(n.content)}"</div>` : ''}
              <div style="font-size:11.5px; color:var(--ink-faint); margin-top:4px;">${formatRelativeTime(n.created_at)}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      stream.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  // =========================================================================
  // VIEW 7: USER PROFILE
  // =========================================================================

  async function loadProfileView() {
    if (!state.user) {
      showToast('Please sign in to view your profile');
      switchAuthTab('login');
      openModal('modalAuth');
      return;
    }

    try {
      const profile = await api('/auth/me');
      $('#profileHeading').textContent = profile.name;
      $('#profileAvatarBig').textContent = getInitials(profile.name);
      $('#profileRoleTag').textContent = profile.role === 'current_student' ? 'Current Student' : (profile.role === 'admin' ? 'Administrator' : 'Prospective Student');

      const colName = profile.college_name ? `${profile.college_name}` : 'No college selected';
      const crsName = profile.course_name ? ` · ${profile.course_name}` : '';
      const yrName = profile.academic_year ? ` · ${profile.academic_year}` : '';
      $('#profileContextText').textContent = colName + crsName + yrName;
      $('#profileBioText').textContent = profile.bio || 'No bio added yet.';

      // Pre-fill edit form
      $('#editProfileName').value = profile.name || '';
      $('#editProfileYear').value = profile.academic_year || '';
      $('#editProfileBio').value = profile.bio || '';
      $('#editProfileInterests').value = profile.interests || '';

      // Load user's discussions tab by default
      loadProfileDiscussions();

      $('#tabMyPosts').onclick = () => {
        $('#tabMyPosts').classList.add('active');
        $('#tabMyReviews').classList.remove('active');
        loadProfileDiscussions();
      };

      $('#tabMyReviews').onclick = () => {
        $('#tabMyReviews').classList.add('active');
        $('#tabMyPosts').classList.remove('active');
        loadProfileReviews();
      };
    } catch (e) {
      showToast(e.message);
    }
  }

  async function loadProfileDiscussions() {
    const container = $('#profileTabContent');
    if (!container || !state.user) return;
    container.innerHTML = '<p style="color:var(--ink-muted);">Loading your discussions…</p>';

    try {
      const res = await api(`/posts?author_id=${state.user.user_id}`);
      const posts = res.posts || [];
      if (!posts.length) {
        container.innerHTML = '<p style="color:var(--ink-muted); padding:20px; text-align:center;">You have not published any questions yet.</p>';
        return;
      }
      container.innerHTML = posts.map(p => `
        <div class="post-card" style="padding:16px; margin-bottom:12px;">
          <h4 style="font-size:16px; font-weight:700; margin-bottom:6px;">${esc(p.title)}</h4>
          <p style="font-size:13.5px; color:var(--ink-secondary); margin-bottom:8px;">${esc(p.content)}</p>
          <div style="font-size:12px; color:var(--ink-muted);">
            ${esc(p.topic)} &middot; ${p.comment_count} answers &middot; ${p.like_count} likes &middot; ${formatRelativeTime(p.created_at)}
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  async function loadProfileReviews() {
    const container = $('#profileTabContent');
    if (!container || !state.user) return;
    container.innerHTML = '<p style="color:var(--ink-muted);">Loading your reviews…</p>';

    try {
      const res = await api(`/reviews?user_id=${state.user.user_id}`);
      const reviews = res.reviews || [];
      if (!reviews.length) {
        container.innerHTML = '<p style="color:var(--ink-muted); padding:20px; text-align:center;">You have not submitted any reviews yet.</p>';
        return;
      }
      container.innerHTML = reviews.map(r => `
        <div class="review-card" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between;">
            <strong>${esc(r.college_name)} &middot; ${esc(r.category)}</strong>
            <span style="color:#f59e0b;">${'★'.repeat(r.rating)}</span>
          </div>
          <p style="font-size:13.5px; color:var(--ink-secondary); margin-top:6px;">${esc(r.review_text)}</p>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  // =========================================================================
  // VIEW 8: SETTINGS & REPORTS MODAL
  // =========================================================================

  function loadSettingsView() {
    $('#settingsEmailText').textContent = state.user ? `${state.user.name} (${state.user.email})` : 'Not signed in';
  }

  async function loadReportsModalData() {
    const container = $('#reportsModalContainer');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--ink-muted);">Computing database reports…</p>';

    try {
      const [r1, r3, r4, r5] = await Promise.all([
        api('/reports/college-posts'),
        api('/reports/topic-counts'),
        api('/reports/useful-discussions?limit=5'),
        api('/reports/average-ratings')
      ]);

      container.innerHTML = `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">1. College-wise Discussion Activity (MySQL LEFT JOIN)</h3>
          <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th style="padding:6px;">College</th>
                <th style="padding:6px;">Posts</th>
                <th style="padding:6px;">Comments</th>
                <th style="padding:6px;">Likes</th>
              </tr>
            </thead>
            <tbody>
              ${r1.map(c => `
                <tr style="border-bottom:1px solid var(--border-light);">
                  <td style="padding:6px;">${esc(c.college_name)}</td>
                  <td style="padding:6px; font-weight:700;">${c.total_posts}</td>
                  <td style="padding:6px;">${c.total_comments}</td>
                  <td style="padding:6px;">${c.total_likes}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">2. Most Discussed Topics (MySQL Subquery &amp; Percentage)</h3>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${r3.map(t => `
              <div style="display:flex; justify-content:space-between; font-size:13px;">
                <span>${esc(t.topic)}</span>
                <strong>${t.total_posts} posts (${t.percentage || 0}%)</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">3. Average Review Rating (MongoDB $group Pipeline)</h3>
          <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th style="padding:6px;">College</th>
                <th style="padding:6px;">Course</th>
                <th style="padding:6px;">Rating</th>
                <th style="padding:6px;">Reviews</th>
              </tr>
            </thead>
            <tbody>
              ${r5.map(m => `
                <tr style="border-bottom:1px solid var(--border-light);">
                  <td style="padding:6px;">${esc(m.college_name)}</td>
                  <td style="padding:6px;">${esc(m.course_name)}</td>
                  <td style="padding:6px; color:#f59e0b; font-weight:700;">★ ${m.avg_rating}</td>
                  <td style="padding:6px;">${m.total_reviews}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--danger);">${esc(e.message)}</p>`;
    }
  }

  // =========================================================================
  // VIEW 9: DATABASE HEALTH & STATISTICS DASHBOARD (ADMIN ONLY)
  // =========================================================================

  let dbAutoRefreshInterval = null;
  let dbCountdownSeconds = 30;
  let dbCachedData = null;

  function formatBytes(bytes, decimals = 1) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + (sizes[i] || 'B');
  }

  function stopDbAutoRefresh() {
    if (dbAutoRefreshInterval) {
      clearInterval(dbAutoRefreshInterval);
      dbAutoRefreshInterval = null;
    }
  }

  function startDbAutoRefresh() {
    stopDbAutoRefresh();
    dbCountdownSeconds = 30;
    updateCountdownUI();

    dbAutoRefreshInterval = setInterval(() => {
      dbCountdownSeconds--;
      if (dbCountdownSeconds <= 0) {
        dbCountdownSeconds = 30;
        loadDatabaseStatusView(false);
      }
      updateCountdownUI();
    }, 1000);
  }

  function updateCountdownUI() {
    const el = $('#dbAutoRefreshCountdown');
    if (el) el.textContent = `Auto-refresh: ${dbCountdownSeconds}s`;
  }

  async function loadDatabaseStatusView(showSpinner = true) {
    const authGate = $('#dbStatusAuthGate');
    const loading = $('#dbStatusLoading');
    const content = $('#dbStatusContent');
    const refreshIcon = $('#dbRefreshIcon');

    // Security Gate: Verify admin role
    if (!state.user || state.user.role !== 'admin') {
      stopDbAutoRefresh();
      if (authGate) authGate.removeAttribute('hidden');
      if (loading) loading.setAttribute('hidden', '');
      if (content) content.setAttribute('hidden', '');

      $('#btnDbQuickAdminLogin')?.addEventListener('click', async () => {
        try {
          const res = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'admin.demo@campustalk.local', password: 'password123' })
          });
          setSession(res.token, res.user);
          showToast('Signed in as Platform Administrator');
          loadDatabaseStatusView(true);
        } catch (err) {
          showToast(err.message);
        }
      });
      return;
    }

    if (authGate) authGate.setAttribute('hidden', '');

    if (showSpinner) {
      if (loading) loading.removeAttribute('hidden');
      if (content) content.setAttribute('hidden', '');
      if (refreshIcon) refreshIcon.style.animation = 'spin 0.8s linear infinite';
    }

    try {
      const [health, mysql, mongodb] = await Promise.all([
        api('/admin/database/health'),
        api('/admin/database/mysql'),
        api('/admin/database/mongodb')
      ]);

      dbCachedData = { health, mysql, mongodb, fetchedAt: new Date().toISOString() };

      renderOverallDbBanner(health);
      renderTopDbCards(health, mysql, mongodb);
      renderDbComparisonTable(health, mysql, mongodb);
      renderDbVisualCharts(mysql, mongodb);
      renderDbStorageAndLatency(mysql, mongodb, health);
      renderDbMysqlTables(mysql);
      renderDbMongoCollections(mongodb);

      const lastChecked = $('#dbLastCheckedTime');
      if (lastChecked) {
        lastChecked.textContent = `Last checked: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }

      if (loading) loading.setAttribute('hidden', '');
      if (content) content.removeAttribute('hidden');

      const pulseDot = $('#dbPulseDot');
      if (pulseDot) {
        pulseDot.className = 'pulse-dot' + (health.overallStatus === 'degraded' ? ' warning' : (health.overallStatus === 'unhealthy' ? ' error' : ''));
      }

      startDbAutoRefresh();
    } catch (err) {
      if (loading) loading.setAttribute('hidden', '');
      if (content) content.removeAttribute('hidden');
      showToast(`Database telemetry query error: ${err.message}`);
    } finally {
      if (refreshIcon) refreshIcon.style.animation = '';
    }
  }

  function renderOverallDbBanner(health) {
    const banner = $('#dbOverallBanner');
    if (!banner) return;

    if (health.overallStatus === 'healthy') {
      banner.className = 'db-health-banner healthy';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:36px; height:36px; border-radius:50%; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800;">✓</div>
          <div>
            <div style="font-size:15px; font-weight:800;">All Databases Fully Operational &amp; Healthy</div>
            <div style="font-size:12.5px; opacity:0.9;">MySQL 8.0 (Relational Store) and MongoDB 7.0+ (Document Store) are actively responding with sub-5ms probe latency.</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="badge-status-healthy">● MySQL: ${esc(health.mysql.status)} (${health.mysql.responseTimeMs} ms)</span>
          <span class="badge-status-healthy">● MongoDB: ${esc(health.mongodb.status)} (${health.mongodb.responseTimeMs} ms)</span>
        </div>
      `;
    } else if (health.overallStatus === 'degraded') {
      banner.className = 'db-health-banner degraded';
      const myOk = health.mysql.status === 'connected';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:36px; height:36px; border-radius:50%; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800;">!</div>
          <div>
            <div style="font-size:15px; font-weight:800;">Database Operational Status: Degraded</div>
            <div style="font-size:12.5px; opacity:0.9;">One database engine is connected while the other is unreachable. Features relying on the failing database may experience errors.</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="${myOk ? 'badge-status-healthy' : 'badge-status-error'}">● MySQL: ${esc(health.mysql.status)}</span>
          <span class="${!myOk ? 'badge-status-healthy' : 'badge-status-error'}">● MongoDB: ${esc(health.mongodb.status)}</span>
        </div>
      `;
    } else {
      banner.className = 'db-health-banner unhealthy';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:36px; height:36px; border-radius:50%; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800;">✕</div>
          <div>
            <div style="font-size:15px; font-weight:800;">Database Operational Status: Unreachable</div>
            <div style="font-size:12.5px; opacity:0.9;">Neither MySQL nor MongoDB is responding to health probes. Verify local server daemons and environment credentials.</div>
          </div>
        </div>
      `;
    }
  }

  function renderTopDbCards(health, mysql, mongodb) {
    const grid = $('#dbTopCardsGrid');
    if (!grid) return;

    const myConnected = mysql.status === 'connected';
    const moConnected = mongodb.status === 'connected';
    const totalStorageBytes = (Number(mysql.totalSizeBytes) || 0) + (Number(mongodb.storageSizeBytes) || 0);
    const avgLatency = ((Number(health.mysql?.responseTimeMs || 0) + Number(health.mongodb?.responseTimeMs || 0)) / 2).toFixed(1);

    grid.innerHTML = `
      <!-- MySQL Card -->
      <div class="db-card">
        <div class="db-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 class="db-card-title">MySQL 8.0</h2>
              <span class="${myConnected ? 'badge-status-healthy' : 'badge-status-error'}">${myConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <p class="db-card-subtitle">Relational Storage Engine (InnoDB)</p>
          </div>
          <span class="db-badge-pill">${esc(mysql.database || 'campustalk')}</span>
        </div>
        ${myConnected ? `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
            <div class="db-metric-tile">
              <div class="db-metric-num">${mysql.totalRecords || 0}</div>
              <div class="db-metric-sub">Exact Rows</div>
            </div>
            <div class="db-metric-tile">
              <div class="db-metric-num">${mysql.tableCount || 0}</div>
              <div class="db-metric-sub">Tables</div>
            </div>
          </div>
          <div style="font-size:12.5px; color:var(--ink-secondary); line-height:1.6;">
            <div>Disk Footprint: <strong>${esc(mysql.formattedTotalSize)}</strong> (Data: ${esc(mysql.formattedDataSize)})</div>
            <div>Active Connections: <strong>${mysql.activeConnections}</strong> / ${mysql.maxConnections} max</div>
            <div>Query Latency: <strong>${mysql.responseTimeMs} ms</strong> &middot; Uptime: <strong>${esc(mysql.formattedUptime)}</strong></div>
          </div>
        ` : `
          <div class="db-alert-disconnected">
            <strong>Connection Failed:</strong> ${esc(mysql.error || 'Server unreachable')}
          </div>
        `}
      </div>

      <!-- MongoDB Card -->
      <div class="db-card">
        <div class="db-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 class="db-card-title">MongoDB</h2>
              <span class="${moConnected ? 'badge-status-healthy' : 'badge-status-error'}">${moConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <p class="db-card-subtitle">Document Engine (WiredTiger)</p>
          </div>
          <span class="db-badge-pill">${esc(mongodb.database || 'campustalk')}</span>
        </div>
        ${moConnected ? `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
            <div class="db-metric-tile">
              <div class="db-metric-num">${mongodb.totalDocuments || 0}</div>
              <div class="db-metric-sub">Documents</div>
            </div>
            <div class="db-metric-tile">
              <div class="db-metric-num">${mongodb.collectionCount || 0}</div>
              <div class="db-metric-sub">Collections</div>
            </div>
          </div>
          <div style="font-size:12.5px; color:var(--ink-secondary); line-height:1.6;">
            <div>Storage Allocated: <strong>${esc(mongodb.formattedStorageSize)}</strong> (Data: ${esc(mongodb.formattedDataSize)})</div>
            <div>Compound Indexes: <strong>${mongodb.indexesCount}</strong> (${esc(mongodb.formattedIndexSize)})</div>
            <div>Round-trip Latency: <strong>${mongodb.responseTimeMs} ms</strong> &middot; Version: <strong>${esc(mongodb.version)}</strong></div>
          </div>
        ` : `
          <div class="db-alert-disconnected">
            <strong>Connection Failed:</strong> ${esc(mongodb.error || 'Server unreachable')}
          </div>
        `}
      </div>

      <!-- Storage & Performance Overview Card -->
      <div class="db-card">
        <div class="db-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 class="db-card-title">Storage &amp; Latency</h2>
              <span class="badge-status-healthy">Live Telemetry</span>
            </div>
            <p class="db-card-subtitle">Dual-Engine Combined Footprint</p>
          </div>
          <span class="db-badge-pill">Polyglot</span>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
          <div class="db-metric-tile">
            <div class="db-metric-num">${esc(formatBytes(totalStorageBytes))}</div>
            <div class="db-metric-sub">Total Storage</div>
          </div>
          <div class="db-metric-tile">
            <div class="db-metric-num">${avgLatency} ms</div>
            <div class="db-metric-sub">Avg Response</div>
          </div>
        </div>
        <div style="font-size:12.5px; color:var(--ink-secondary); line-height:1.6;">
          <div>MySQL Allocated: <strong>${esc(mysql.formattedTotalSize || '0 B')}</strong></div>
          <div>MongoDB Allocated: <strong>${esc(mongodb.formattedStorageSize || '0 B')}</strong></div>
          <div>Probe Verification Time: <strong>${health.totalResponseTimeMs} ms</strong></div>
        </div>
      </div>
    `;
  }

  function renderDbComparisonTable(health, mysql, mongodb) {
    const table = $('#dbComparisonTable');
    if (!table) return;

    const myConnected = mysql.status === 'connected';
    const moConnected = mongodb.status === 'connected';

    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 25%;">Metric / Dimension</th>
          <th style="width: 37.5%;">MySQL 8.0 (Relational Store)</th>
          <th style="width: 37.5%;">MongoDB 7.0+ (Document Store)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Operational Status</strong></td>
          <td>
            <span class="${myConnected ? 'badge-status-healthy' : 'badge-status-error'}">
              ${myConnected ? 'Connected &middot; ' + mysql.responseTimeMs + ' ms' : 'Disconnected'}
            </span>
          </td>
          <td>
            <span class="${moConnected ? 'badge-status-healthy' : 'badge-status-error'}">
              ${moConnected ? 'Connected &middot; ' + mongodb.responseTimeMs + ' ms' : 'Disconnected'}
            </span>
          </td>
        </tr>
        <tr>
          <td><strong>Architectural Role</strong></td>
          <td>Authoritative Domain Entities (Users, Colleges, Courses, Posts, Comments, Likes, Follows)</td>
          <td>Flexible Student Experience Reviews &amp; Heterogeneous Feedback Documents</td>
        </tr>
        <tr>
          <td><strong>Schema Paradigm</strong></td>
          <td>Strict Relational Schema (1NF, 2NF, 3NF, BCNF) with Foreign Key Constraints &amp; Cascades</td>
          <td>Dynamic Document Collections (BSON) accommodating variable attributes by review category</td>
        </tr>
        <tr>
          <td><strong>Data Structures</strong></td>
          <td><strong>${mysql.tableCount || 0} Tables</strong> (In-schema normalized tables)</td>
          <td><strong>${mongodb.collectionCount || 0} Collections</strong> (Document collections)</td>
        </tr>
        <tr>
          <td><strong>Record Volume</strong></td>
          <td><strong>${mysql.totalRecords || 0} Total Rows</strong> (Exact count via SELECT COUNT)</td>
          <td><strong>${mongodb.totalDocuments || 0} Total Documents</strong> (Reviews count)</td>
        </tr>
        <tr>
          <td><strong>Storage Footprint</strong></td>
          <td><strong>${esc(mysql.formattedTotalSize || '0 B')}</strong> (Data: ${esc(mysql.formattedDataSize)}, Indexes: ${esc(mysql.formattedIndexSize)})</td>
          <td><strong>${esc(mongodb.formattedTotalSize || '0 B')}</strong> (Storage: ${esc(mongodb.formattedStorageSize)}, Indexes: ${esc(mongodb.formattedIndexSize)})</td>
        </tr>
        <tr>
          <td><strong>Round-Trip Ping Latency</strong></td>
          <td><strong>${mysql.responseTimeMs || 0} ms</strong> (Connection pool query)</td>
          <td><strong>${mongodb.responseTimeMs || 0} ms</strong> (Admin ping command)</td>
        </tr>
        <tr>
          <td><strong>Concurrency &amp; Transactions</strong></td>
          <td>ACID Transactions &amp; Row-Level Locking (InnoDB Engine)</td>
          <td>Document-Level Atomicity &amp; WiredTiger Cache Engine</td>
        </tr>
        <tr>
          <td><strong>Query Language &amp; Access</strong></td>
          <td>Declarative SQL with Parameterized Prepared Statements</td>
          <td>MongoDB Multi-Stage Aggregation Pipelines ($match, $group, $sort)</td>
        </tr>
      </tbody>
    `;
  }

  function renderDbVisualCharts(mysql, mongodb) {
    // 1. MySQL Table Distribution Chart
    const mysqlChart = $('#mysqlDistributionChart');
    const mysqlBadge = $('#mysqlTotalRowsBadge');
    if (mysqlChart) {
      if (mysql.status === 'connected' && mysql.tables && mysql.tables.length > 0) {
        if (mysqlBadge) mysqlBadge.textContent = `${mysql.totalRecords} Rows`;
        const total = mysql.totalRecords || 1;
        mysqlChart.innerHTML = mysql.tables.map(t => {
          const pct = Math.max(2, Math.round((t.rowCount / total) * 100));
          return `
            <div class="db-prog-item">
              <div class="db-prog-labels">
                <span><strong>${esc(t.tableName)}</strong> <span style="color:var(--ink-muted); font-size:11px;">(${t.formattedTotalSize})</span></span>
                <span><strong>${t.rowCount}</strong> rows (${pct}%)</span>
              </div>
              <div class="db-prog-track">
                <div class="db-prog-fill" style="width: ${pct}%; background: var(--primary);"></div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        mysqlChart.innerHTML = `<p style="color:var(--ink-muted); font-size:13px;">MySQL table statistics unavailable.</p>`;
      }
    }

    // 2. MongoDB Category Breakdown Chart
    const mongoChart = $('#mongoDistributionChart');
    const mongoBadge = $('#mongoTotalDocsBadge');
    if (mongoChart) {
      if (mongodb.status === 'connected' && mongodb.categoryBreakdown && mongodb.categoryBreakdown.length > 0) {
        if (mongoBadge) mongoBadge.textContent = `${mongodb.totalDocuments} Reviews`;
        const total = mongodb.totalDocuments || 1;
        mongoChart.innerHTML = mongodb.categoryBreakdown.map(c => {
          const pct = Math.max(4, Math.round((c.count / total) * 100));
          return `
            <div class="db-prog-item">
              <div class="db-prog-labels">
                <span><strong>${esc(c.category)}</strong> <span style="color:#f59e0b; font-size:11.5px;">★ ${c.avgRating}</span></span>
                <span><strong>${c.count}</strong> reviews (${pct}%)</span>
              </div>
              <div class="db-prog-track">
                <div class="db-prog-fill" style="width: ${pct}%; background: #059669;"></div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        mongoChart.innerHTML = `<p style="color:var(--ink-muted); font-size:13px;">No category breakdown documents recorded yet.</p>`;
      }
    }
  }

  function renderDbStorageAndLatency(mysql, mongodb, health) {
    // 1. Storage Comparison Bar
    const storageChart = $('#storageComparisonChart');
    const storageBadge = $('#dbCombinedStorageBadge');
    if (storageChart) {
      const myBytes = Number(mysql.totalSizeBytes) || 0;
      const moBytes = Number(mongodb.storageSizeBytes) || 0;
      const totalBytes = myBytes + moBytes || 1;
      const myPct = Math.round((myBytes / totalBytes) * 100);
      const moPct = 100 - myPct;

      if (storageBadge) storageBadge.textContent = `${formatBytes(totalBytes)} Total`;

      storageChart.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:var(--primary); margin-right:4px;"></span>MySQL: <strong>${esc(mysql.formattedTotalSize || '0 B')}</strong> (${myPct}%)</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#059669; margin-right:4px;"></span>MongoDB: <strong>${esc(mongodb.formattedStorageSize || '0 B')}</strong> (${moPct}%)</span>
        </div>
        <div style="display:flex; height:14px; border-radius:var(--radius-full); overflow:hidden; background:var(--bg-subtle);">
          <div style="width:${myPct}%; background:var(--primary); transition:width 0.4s ease;" title="MySQL Storage: ${esc(mysql.formattedTotalSize)}"></div>
          <div style="width:${moPct}%; background:#059669; transition:width 0.4s ease;" title="MongoDB Storage: ${esc(mongodb.formattedStorageSize)}"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-muted); margin-top:8px;">
          <span>MySQL Buffer Pool: ${esc(mysql.formattedBufferPoolSize || 'N/A')}</span>
          <span>MongoDB Uncompressed Data: ${esc(mongodb.formattedDataSize || 'N/A')}</span>
        </div>
      `;
    }

    // 2. Query Latency Breakdown
    const latencyChart = $('#latencyComparisonChart');
    const latencyBadge = $('#latencyRatingBadge');
    if (latencyChart) {
      const myLat = Number(mysql.responseTimeMs) || 0;
      const moLat = Number(mongodb.responseTimeMs) || 0;
      const maxLat = Math.max(myLat, moLat);

      if (latencyBadge) {
        if (maxLat < 5) {
          latencyBadge.textContent = 'Optimal (< 5ms)';
          latencyBadge.className = 'badge-status-healthy';
        } else if (maxLat < 20) {
          latencyBadge.textContent = 'Acceptable (5-20ms)';
          latencyBadge.className = 'badge-status-degraded';
        } else {
          latencyBadge.textContent = 'Elevated (> 20ms)';
          latencyBadge.className = 'badge-status-error';
        }
      }

      // Proportional bar out of 25ms scale
      const myBarPct = Math.min(100, Math.max(5, Math.round((myLat / 25) * 100)));
      const moBarPct = Math.min(100, Math.max(5, Math.round((moLat / 25) * 100)));

      latencyChart.innerHTML = `
        <div class="db-prog-container">
          <div class="db-prog-item">
            <div class="db-prog-labels">
              <span><strong>MySQL Connection Latency</strong></span>
              <span><strong>${myLat} ms</strong></span>
            </div>
            <div class="db-prog-track">
              <div class="db-prog-fill" style="width:${myBarPct}%; background:var(--primary);"></div>
            </div>
          </div>
          <div class="db-prog-item">
            <div class="db-prog-labels">
              <span><strong>MongoDB Ping Latency</strong></span>
              <span><strong>${moLat} ms</strong></span>
            </div>
            <div class="db-prog-track">
              <div class="db-prog-fill" style="width:${moBarPct}%; background:#059669;"></div>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-muted); margin-top:4px;">
            <span>Target: &lt; 10 ms for real-time web workloads</span>
            <span>Total Probe Verification: ${health.totalResponseTimeMs} ms</span>
          </div>
        </div>
      `;
    }
  }

  function renderDbMysqlTables(mysql) {
    const list = $('#mysqlTablesList tbody');
    const meta = $('#mysqlRuntimeMeta');
    if (meta) {
      meta.textContent = `Version ${mysql.version || '8.0'} · Charset: ${mysql.charset || 'utf8mb4'} · Uptime: ${mysql.formattedUptime || 'N/A'}`;
    }

    if (!list) return;

    if (!mysql.tables || mysql.tables.length === 0) {
      list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--ink-muted); padding:16px;">No tables found or MySQL disconnected.</td></tr>`;
      return;
    }

    const schemaRoles = {
      colleges: 'Core Directory (PK: college_id)',
      courses: 'Degree Programs (FK: college_id)',
      topics: 'Discussion Taxonomy (PK: topic_id)',
      users: 'Accounts & Roles (PK: user_id)',
      posts: 'Discussions & Qs (FK: course_id, user_id)',
      comments: 'Threaded Replies (FK: post_id, user_id)',
      likes: 'Vote Toggles (UK: post_id, user_id)',
      follows: 'Student Subscriptions (PK: follower, followed)'
    };

    list.innerHTML = mysql.tables.map(t => {
      const lower = t.tableName.toLowerCase();
      const roleDesc = schemaRoles[lower] || 'Relational Entity Table';
      return `
        <tr>
          <td><strong style="color:var(--primary); font-family:monospace; font-size:13px;">${esc(t.tableName)}</strong></td>
          <td><span style="font-size:12px; color:var(--ink-secondary);">${esc(roleDesc)}</span></td>
          <td style="text-align:right; font-weight:700;">${t.rowCount}</td>
          <td style="text-align:right; font-size:12.5px; color:var(--ink-secondary);">${esc(t.formattedDataSize)}</td>
          <td style="text-align:right; font-size:12.5px; color:var(--ink-secondary);">${esc(t.formattedIndexSize)}</td>
          <td style="text-align:right; font-weight:700;">${esc(t.formattedTotalSize)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderDbMongoCollections(mongodb) {
    const list = $('#mongoCollectionsList tbody');
    const meta = $('#mongoRuntimeMeta');
    if (meta) {
      meta.textContent = `Version ${mongodb.version || '7.0'} · Storage Engine: WiredTiger · Indexes: ${mongodb.indexesCount || 0}`;
    }

    if (!list) return;

    if (!mongodb.collections || mongodb.collections.length === 0) {
      list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--ink-muted); padding:16px;">No collections found or MongoDB disconnected.</td></tr>`;
      return;
    }

    list.innerHTML = mongodb.collections.map(c => {
      return `
        <tr>
          <td><strong style="color:#059669; font-family:monospace; font-size:13px;">${esc(c.collectionName)}</strong></td>
          <td><span style="font-size:12px; color:var(--ink-secondary); text-transform:capitalize;">${esc(c.type || 'Document Store')}</span></td>
          <td style="text-align:right; font-weight:700;">${c.documentCount}</td>
          <td style="text-align:right; font-size:12.5px; color:var(--ink-secondary);">${esc(formatBytes(mongodb.dataSizeBytes))}</td>
          <td style="text-align:right; font-size:12.5px; font-weight:700;">${esc(c.formattedStorageSize)}</td>
          <td style="text-align:right; font-weight:700;">${c.indexCount || 5} indexes</td>
        </tr>
      `;
    }).join('');
  }

  function copyDbDiagnostics() {
    if (!dbCachedData) {
      showToast('No telemetry data available to copy.');
      return;
    }
    const jsonStr = JSON.stringify(dbCachedData, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('Database diagnostics JSON copied to clipboard');
      }).catch(() => {
        showToast('Diagnostics ready (check console)');
        console.log(jsonStr);
      });
    } else {
      console.log('Database diagnostics:', jsonStr);
      showToast('Diagnostics logged to browser console');
    }
  }

  // =========================================================================
  // RIGHT RAIL WIDGETS (Unanswered Questions & Popular Colleges)
  // =========================================================================

  async function loadRightRailWidgets() {
    // 1. Unanswered Questions
    const list = $('#railUnansweredList');
    if (list) {
      try {
        const res = await api('/posts?unanswered=true&limit=3');
        const posts = res.posts || [];
        if (!posts.length) {
          list.innerHTML = '<li class="rail-item"><span style="color:var(--ink-muted); font-size:12px;">All questions answered!</span></li>';
        } else {
          list.innerHTML = posts.map(p => `
            <li class="rail-item">
              <div class="rail-item-title btn-open-post" data-id="${p.post_id}">${esc(p.title)}</div>
              <div class="rail-item-sub">${esc(p.college_name)} &middot; ${formatRelativeTime(p.created_at)}</div>
            </li>
          `).join('');

          list.querySelectorAll('.btn-open-post').forEach(b => {
            b.addEventListener('click', () => {
              state.filters.q = b.textContent.trim();
              switchView('home');
            });
          });
        }
      } catch (e) {
        list.innerHTML = '<li class="rail-item"><span style="color:var(--ink-muted); font-size:12px;">No items</span></li>';
      }
    }

    // 2. Popular Colleges
    const colList = $('#railTopCollegesList');
    if (colList && state.colleges.length) {
      colList.innerHTML = state.colleges.slice(0, 4).map(c => `
        <li class="rail-item" style="cursor:pointer;" data-col-id="${c.college_id}">
          <div class="rail-item-title">${esc(c.college_name)}</div>
          <div class="rail-item-sub">📍 ${esc(c.location)} &middot; ${c.post_count || 0} posts</div>
        </li>
      `).join('');

      colList.querySelectorAll('.rail-item').forEach(item => {
        item.addEventListener('click', () => {
          openCollegeDetail(Number(item.dataset.colId));
        });
      });
    }
  }

  // =========================================================================
  // GLOBAL SEARCH (Instant Suggestions)
  // =========================================================================

  function setupGlobalSearch() {
    const input = $('#homeSearchInput');
    const dropdown = $('#homeSearchDropdown');
    const clearBtn = $('#homeSearchClear');
    if (!input || !dropdown) return;

    let debounceTimer;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.toggleAttribute('hidden', !q);

      clearTimeout(debounceTimer);
      if (!q) {
        dropdown.classList.remove('visible');
        dropdown.innerHTML = '';
        state.filters.q = '';
        updateActiveFilterBadge();
        loadHomeFeed();
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await api(`/search?q=${encodeURIComponent(q)}`);
          renderSearchDropdown(res, q);
        } catch (e) {
          dropdown.classList.remove('visible');
        }
      }, 250);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dropdown.classList.remove('visible');
        state.filters.q = input.value.trim();
        updateActiveFilterBadge();
        loadHomeFeed();
      }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      clearBtn.setAttribute('hidden', '');
      dropdown.classList.remove('visible');
      state.filters.q = '';
      updateActiveFilterBadge();
      loadHomeFeed();
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('visible');
      }
    });
  }

  function renderSearchDropdown(data, query) {
    const dropdown = $('#homeSearchDropdown');
    if (!dropdown) return;

    const { colleges = [], posts = [], courses = [] } = data;
    if (!colleges.length && !posts.length && !courses.length) {
      dropdown.innerHTML = `
        <div style="padding: 16px; text-align: center; font-size: 13px; color: var(--ink-muted);">
          No results found for "${esc(query)}". Press Enter to search discussions.
        </div>
      `;
      dropdown.classList.add('visible');
      return;
    }

    let html = '';

    if (colleges.length > 0) {
      html += `<div class="search-result-group"><div class="search-group-title">Colleges</div>`;
      colleges.forEach(c => {
        html += `
          <div class="search-result-item search-item-col" data-col-id="${c.college_id}">
            <div>
              <div class="search-item-main">${esc(c.college_name)}</div>
              <div class="search-item-sub">📍 ${esc(c.location)}, ${esc(c.state)}</div>
            </div>
            <span style="font-size:11px; color:var(--primary); font-weight:700;">Explore &rarr;</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    if (posts.length > 0) {
      html += `<div class="search-result-group"><div class="search-group-title">Questions</div>`;
      posts.forEach(p => {
        html += `
          <div class="search-result-item search-item-post" data-post-title="${esc(p.title)}">
            <div style="min-width:0;">
              <div class="search-item-main" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.title)}</div>
              <div class="search-item-sub">${esc(p.college_name)} &middot; ${esc(p.topic)}</div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('visible');

    // Click handlers
    dropdown.querySelectorAll('.search-item-col').forEach(item => {
      item.addEventListener('click', () => {
        dropdown.classList.remove('visible');
        openCollegeDetail(Number(item.dataset.colId));
      });
    });

    dropdown.querySelectorAll('.search-item-post').forEach(item => {
      item.addEventListener('click', () => {
        dropdown.classList.remove('visible');
        $('#homeSearchInput').value = item.dataset.postTitle;
        state.filters.q = item.dataset.postTitle;
        updateActiveFilterBadge();
        loadHomeFeed();
      });
    });
  }

  // Question Creation & Review Creation Flow Helpers
  function triggerAskFlow(preselectedCollegeId = null) {
    if (!state.user) {
      showToast('Please sign in to ask a question');
      switchAuthTab('login');
      openModal('modalAuth');
      return;
    }

    const colSel = $('#askCollege');
    if (colSel && state.colleges.length) {
      colSel.innerHTML = '<option value="">-- Choose College --</option>' + state.colleges.map(c => `
        <option value="${c.college_id}" ${preselectedCollegeId && Number(preselectedCollegeId) === c.college_id ? 'selected' : ''}>
          ${esc(c.college_name)} (${esc(c.location)})
        </option>
      `).join('');
    }

    setupCourseSelectOptions('askCollege', 'askCourse');
    openModal('modalAsk');
  }

  function triggerReviewFlow(collegeName = '') {
    if (!state.user) {
      showToast('Please sign in to write a review');
      switchAuthTab('login');
      openModal('modalAuth');
      return;
    }
    if (collegeName) $('#revCollege').value = collegeName;
    openModal('modalReview');
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Navigation items
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    $$('.mobile-nav-btn').forEach(btn => {
      if (btn.dataset.view) {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
      }
    });

    // Ask buttons
    $('#btnSidebarAsk')?.addEventListener('click', () => triggerAskFlow());
    $('#mobileNavAskBtn')?.addEventListener('click', () => triggerAskFlow());
    $('#btnOpenAskFromDiscussions')?.addEventListener('click', () => triggerAskFlow());
    $('#btnOpenWriteReview')?.addEventListener('click', () => triggerReviewFlow());

    // Back button in College Detail
    $('#btnBackToExplore')?.addEventListener('click', () => switchView('explore'));

    // Modal close buttons
    $$('.modal-close-btn, .btn-modal-cancel').forEach(b => {
      b.addEventListener('click', () => closeModal());
    });

    // Backdrop click closes modal
    $$('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', (e) => {
        if (e.target === bd) closeModal();
      });
    });

    // Mobile Top Bar
    $('#btnMobileSearchTrigger')?.addEventListener('click', () => {
      switchView('home');
      setTimeout(() => $('#homeSearchInput')?.focus(), 50);
    });
    $('#btnMobileNotificationsTrigger')?.addEventListener('click', () => {
      switchView('notifications');
    });

    // Brand link
    $('#brandHomeLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });

    // Filter Chips in Home Feed
    $$('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        if (pill.dataset.special === 'unanswered') {
          state.filters.unanswered = 'true';
          state.filters.topic = '';
        } else {
          state.filters.unanswered = '';
          state.filters.topic = pill.dataset.topic || '';
        }

        state.pagination.page = 1;
        updateActiveFilterBadge();
        loadHomeFeed();
      });
    });

    // Sort Toggle Buttons (Latest vs Popular)
    $('#sortBtnLatest')?.addEventListener('click', () => {
      $('#sortBtnLatest').classList.add('active');
      $('#sortBtnPopular').classList.remove('active');
      state.filters.sort = 'recent';
      state.pagination.page = 1;
      loadHomeFeed();
    });

    $('#sortBtnPopular')?.addEventListener('click', () => {
      $('#sortBtnPopular').classList.add('active');
      $('#sortBtnLatest').classList.remove('active');
      state.filters.sort = 'popular';
      state.pagination.page = 1;
      loadHomeFeed();
    });

    // Auth Modal Tabs
    $('#btnTabAuthLogin')?.addEventListener('click', () => switchAuthTab('login'));
    $('#btnTabAuthRegister')?.addEventListener('click', () => switchAuthTab('register'));

    // Login Form Submit
    $('#formModalLogin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;

      try {
        const res = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setSession(res.token, res.user);
        closeModal('modalAuth');
        showToast(`Welcome back, ${res.user.name}!`);
        loadHomeFeed();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Register Form Submit
    $('#formModalRegister')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#regName').value.trim();
      const email = $('#regEmail').value.trim();
      const password = $('#regPassword').value;
      const role = $('#regRole').value;
      const academic_year = $('#regYear').value.trim();

      try {
        const res = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role, academic_year })
        });
        setSession(res.token, res.user);
        closeModal('modalAuth');
        showToast(`Welcome to CampusTalk, ${res.user.name}!`);
        loadHomeFeed();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Ask Question Form Submit
    $('#formAskQuestion')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const course_id = Number($('#askCourse').value);
      const title = $('#askTitle').value.trim();
      const content = $('#askContent').value.trim();
      const topic = $('#askTopic').value;

      if (!course_id) {
        showToast('Please select a course');
        return;
      }

      try {
        await api('/posts', {
          method: 'POST',
          body: JSON.stringify({ course_id, title, content, topic })
        });
        $('#formAskQuestion').reset();
        closeModal('modalAsk');
        showToast('Question published!');
        state.pagination.page = 1;
        loadHomeFeed();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Write Review Form Submit
    $('#formWriteReview')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const college_name = $('#revCollege').value.trim();
      const course_name = $('#revCourse').value.trim();
      const category = $('#revCategory').value;
      const rating = Number($('#revRating').value);
      const title = $('#revTitle').value.trim();
      const review_text = $('#revText').value.trim();
      const pros = $('#revPros').value.trim();
      const cons = $('#revCons').value.trim();
      const advice_to_juniors = $('#revAdvice').value.trim();

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
        $('#formWriteReview').reset();
        closeModal('modalReview');
        showToast('Review submitted!');
        loadReviewsView();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Edit Post Submit
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
        showToast('Discussion updated');
        loadHomeFeed();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Edit Profile Modal Open & Submit
    $('#btnEditProfileTrigger')?.addEventListener('click', () => {
      openModal('modalEditProfile');
    });

    $('#formEditProfile')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#editProfileName').value.trim();
      const academic_year = $('#editProfileYear').value.trim();
      const bio = $('#editProfileBio').value.trim();
      const interests = $('#editProfileInterests').value.trim();

      try {
        await api('/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name, academic_year, bio, interests })
        });
        state.user.name = name;
        state.user.academic_year = academic_year;
        state.user.bio = bio;
        state.user.interests = interests;
        localStorage.setItem('campustalk_user', JSON.stringify(state.user));
        closeModal('modalEditProfile');
        showToast('Profile updated');
        loadProfileView();
        updateAuthUI();
      } catch (err) {
        showToast(err.message);
      }
    });

    // Settings Sign Out
    $('#btnSettingsSignOut')?.addEventListener('click', () => logout());

    // Reports Modal Open
    $('#btnOpenReportsModal')?.addEventListener('click', () => {
      openModal('modalReports');
      loadReportsModalData();
    });
    $('#railDbmsLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('modalReports');
      loadReportsModalData();
    });

    // Database Status Dashboard Listeners
    $('#btnRefreshDbStatus')?.addEventListener('click', () => loadDatabaseStatusView(true));
    $('#btnOpenDbStatusFromSettings')?.addEventListener('click', () => switchView('database-status'));
    $('#railDbStatusLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('database-status');
    });
    $('#btnCopyDbDiagnostics')?.addEventListener('click', copyDbDiagnostics);

    // Right rail explore all link
    $('#railExploreAllLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('explore');
    });

    $('#railViewProfileBtn')?.addEventListener('click', () => {
      switchView('profile');
    });

    // Explore colleges city chips
    $$('[data-city]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-city]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const city = chip.dataset.city;
        if (!city) {
          renderCollegeGrid(state.colleges);
        } else {
          renderCollegeGrid(state.colleges.filter(c => c.location && c.location.toLowerCase().includes(city.toLowerCase())));
        }
      });
    });

    // Explore search filter
    $('#exploreSearchInput')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderCollegeGrid(state.colleges);
      } else {
        renderCollegeGrid(state.colleges.filter(c =>
          c.college_name.toLowerCase().includes(q) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.state && c.state.toLowerCase().includes(q))
        ));
      }
    });

    // Discussions view filters
    $('#discCollegeSelect')?.addEventListener('change', loadDiscussionsView);
    $('#discTopicSelect')?.addEventListener('change', loadDiscussionsView);
    $('#discSortSelect')?.addEventListener('change', loadDiscussionsView);
    let discTimer;
    $('#discSearchInput')?.addEventListener('input', () => {
      clearTimeout(discTimer);
      discTimer = setTimeout(loadDiscussionsView, 300);
    });

    // Reviews search & category
    $('#reviewsCollegeSearch')?.addEventListener('input', (e) => {
      state.reviewFilters.college = e.target.value.trim();
      loadReviewsView();
    });

    $$('[data-rev-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-rev-cat]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.reviewFilters.category = chip.dataset.revCat || '';
        loadReviewsView();
      });
    });
  }

  // App Initialization
  async function init() {
    updateAuthUI();
    setupGlobalSearch();
    setupEventListeners();

    try {
      const [colleges, courses, topics] = await Promise.all([
        api('/colleges'),
        api('/courses'),
        api('/topics')
      ]);

      state.colleges = colleges;
      state.courses = courses;
      state.topics = topics;

      // Populate college filter in Discussions view
      const discColSel = $('#discCollegeSelect');
      if (discColSel) {
        colleges.forEach(c => {
          discColSel.insertAdjacentHTML('beforeend', `<option value="${c.college_id}">${esc(c.college_name)}</option>`);
        });
      }

      // Populate topic filters
      const discTopicSel = $('#discTopicSelect');
      if (discTopicSel) {
        topics.forEach(t => {
          discTopicSel.insertAdjacentHTML('beforeend', `<option value="${esc(t.topic_name)}">${esc(t.topic_name)}</option>`);
        });
      }

      loadHomeFeed();
      loadRightRailWidgets();
    } catch (e) {
      console.warn('Initial reference data load error:', e.message);
      loadHomeFeed();
    }
  }

  // Global methods for inline accessibility
  window.CampusTalk = {
    state,
    api,
    switchView,
    openModal,
    closeModal,
    triggerAskFlow,
    triggerReviewFlow,
    loadHomeFeed,
    loadDatabaseStatusView,
    openSignIn: () => {
      switchAuthTab('login');
      openModal('modalAuth');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
